// Island geometry (spec §6.1). Each region is cut into chunks (3 angular × 3 radial) so the regions
// that aren't selected can break apart and fall into the sea during the dive (spec §9.2). Every chunk
// carries the terrain it covers plus the decorations standing on it, merged into one mesh.
import { BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3, type ColorRepresentation } from 'three';
import type { EnvId } from '../../config/sections';
import { fbm } from '../../lib/noise';
import { rng, range, type Rng } from '../../lib/rng';
import { smoothstep } from '../../lib/ease';
import { box, cloud, cone, cylinder, flat, jitter, merge, paint, paintFaces, pine, place, rock, tree } from '../../render/geo';
import { barn, farmhouse, fence, field, silo, type Crop } from '../common/farm';
import { barrel, fishCrate, fishingBoat, pier, stall } from '../common/harbor';
import { boundaryWobble, islandRadius, REGIONS, type RegionDef } from './layout';

const BOTTOM = -2.4;
/** Angle of the fishing harbour's cove on the coast region. */
const COVE_A = 0.26;
const RADIAL = [0.06, 0.4, 0.72, 1.0];
const ANG_SPLITS = 3;

export interface ChunkBuild {
  geometry: BufferGeometry;
  /**
   * Middle of the chunk's footprint: the pivot it tumbles about when it falls. The geometry stays in
   * region coordinates, so at rest every chunk of a region shares one transform and the seams
   * between chunks stay watertight (no pixel cracks sparkling as the camera or region moves).
   */
  center: Vector3;
  /** Height of the chunk top above water, for splash timing. */
  top: number;
  ring: number;
  sector: number;
}

export interface RegionBuild {
  def: RegionDef;
  chunks: ChunkBuild[];
}

function heightAt(env: EnvId, x: number, z: number, f: number): number {
  switch (env) {
    case 'plains':
      return 0.42 + 0.05 * fbm(x * 0.3, z * 0.3, 5) - 0.14 * smoothstep(0.9, 1, f);
    case 'glacier':
      return 0.75 + 0.3 * fbm(x * 0.3, z * 0.3, 8) - 0.1 * smoothstep(0.9, 1, f);
    case 'gym':
      return 0.5 + 0.03 * fbm(x * 0.5, z * 0.5, 4);
    case 'coast': {
      // Cliffs rise toward the rim, except in the harbour cove where the land runs down to a beach.
      const cove = Math.exp(-(((Math.atan2(z, x) - COVE_A) / 0.22) ** 2));
      return 0.42 + 1.05 * smoothstep(0.42, 0.96, f) * (1 - cove) + 0.12 * fbm(x * 0.4, z * 0.4, 6) * (1 - cove * 0.7);
    }
  }
}

const TOP: Record<EnvId, (c: Vector3, f: number) => ColorRepresentation> = {
  plains: (c) => (fbm(c.x * 0.6, c.z * 0.6, 21) > 0.08 ? '#62c046' : '#72d152'),
  glacier: (c) => {
    const n = fbm(c.x * 0.5, c.z * 0.5, 22);
    return n > 0.3 ? '#8a8fa8' : n > 0 ? '#e6eefb' : '#f7faff';
  },
  gym: (c) => (fbm(c.x * 0.7, c.z * 0.7, 23) > 0.25 ? '#8fd694' : '#d8d0c0'),
  coast: (_c, f) => (f > 0.84 ? '#d9a066' : f > 0.7 ? '#a8cf62' : '#8cc956'),
};

const SIDE: Record<EnvId, [ColorRepresentation, ColorRepresentation]> = {
  plains: ['#a3703f', '#7a4f2e'],
  glacier: ['#737892', '#4b4f66'],
  gym: ['#a49a88', '#7d7466'],
  coast: ['#c9845c', '#9a5d44'],
};

interface GridPoint {
  p: Vector3;
  f: number;
}

/** Angle at fraction t across a region (0 = a0 edge, 1 = a1 edge), with the winding boundaries. */
function regionAngle(def: RegionDef, t: number, f: number): number {
  const e0 = def.a0 + boundaryWobble(def.a0, f);
  const e1 = def.a1 + boundaryWobble(def.a1, f);
  return e0 + (e1 - e0) * t;
}

function buildChunkTerrain(def: RegionDef, sector: number, ring: number): BufferGeometry {
  const env = def.env;
  const f0 = RADIAL[ring]!;
  const f1 = RADIAL[ring + 1]!;
  const na = 4;
  const nf = 3;

  const grid: GridPoint[][] = [];
  for (let i = 0; i <= na; i++) {
    const row: GridPoint[] = [];
    // Position across the whole region (0..1), so chunk seams inside a region line up.
    const t = (sector * na + i) / (ANG_SPLITS * na);
    for (let j = 0; j <= nf; j++) {
      // Exact ring edges, so neighbouring chunks share bit-identical seam vertices.
      const f = j === 0 ? f0 : j === nf ? f1 : f0 + ((f1 - f0) * j) / nf;
      const a = regionAngle(def, t, f);
      const R = islandRadius(a);
      const x = Math.cos(a) * f * R;
      const z = Math.sin(a) * f * R;
      row.push({ p: new Vector3(x, heightAt(env, x, z, f), z), f });
    }
    grid.push(row);
  }

  const pos: number[] = [];
  const center = new Vector3();
  for (const row of grid) for (const g of row) center.add(g.p);
  center.divideScalar((na + 1) * (nf + 1));

  const tri = (a: Vector3, b: Vector3, c: Vector3, want: Vector3) => {
    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    if (n.dot(want) < 0) pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    else pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const upV = new Vector3(0, 1, 0);

  // Top surface.
  for (let i = 0; i < na; i++) {
    for (let j = 0; j < nf; j++) {
      const p00 = grid[i]![j]!.p;
      const p10 = grid[i + 1]![j]!.p;
      const p11 = grid[i + 1]![j + 1]!.p;
      const p01 = grid[i]![j + 1]!.p;
      tri(p00, p10, p11, upV);
      tri(p00, p11, p01, upV);
    }
  }

  // Side skirts down below the water, with a lip band just under the top edge. On the seams between
  // chunks (only seen once the chunks break apart) the skirt is tucked in and down under this
  // chunk's own top: flush with the edge, it would sit at exactly the neighbour's depth along the
  // seam, z-fight with it, and the stray pixels showed up as flickering ink specks.
  const skirt = (edge: Vector3[], seam: boolean) => {
    const tuck = seam ? 0.05 : 0;
    for (let k = 0; k < edge.length - 1; k++) {
      const a0 = edge[k]!;
      const b0 = edge[k + 1]!;
      const out = new Vector3((a0.x + b0.x) / 2 - center.x, 0, (a0.z + b0.z) / 2 - center.z).normalize();
      const a = new Vector3(a0.x - out.x * tuck, a0.y - tuck, a0.z - out.z * tuck);
      const b = new Vector3(b0.x - out.x * tuck, b0.y - tuck, b0.z - out.z * tuck);
      const am = new Vector3(a.x, a0.y - 0.28, a.z);
      const bm = new Vector3(b.x, b0.y - 0.28, b.z);
      const ab = new Vector3(a.x, BOTTOM, a.z);
      const bb = new Vector3(b.x, BOTTOM, b.z);
      tri(a, b, bm, out);
      tri(a, bm, am, out);
      tri(am, bm, bb, out);
      tri(am, bb, ab, out);
    }
  };
  skirt(
    grid.map((row) => row[nf]!.p),
    ring < RADIAL.length - 2,
  );
  skirt(
    grid.map((row) => row[0]!.p),
    ring > 0,
  );
  skirt(
    grid[0]!.map((g) => g.p),
    sector > 0,
  );
  skirt(
    grid[na]!.map((g) => g.p),
    sector < ANG_SPLITS - 1,
  );

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  const [lip, dirt] = SIDE[env];
  paintFaces(g, (c, n) => {
    if (n.y > 0.45) {
      const f = Math.hypot(c.x, c.z) / islandRadius(Math.atan2(c.z, c.x));
      return TOP[env](c, f);
    }
    return c.y > heightAt(env, c.x, c.z, 1) - 0.4 && c.y > 0.1 ? lip : dirt;
  });
  return g;
}

/** Which chunk a decoration at (a, f) belongs to. */
function chunkIndex(def: RegionDef, a: number, f: number): number {
  const sector = Math.min(ANG_SPLITS - 1, Math.max(0, Math.floor(((a - def.a0) / (def.a1 - def.a0)) * ANG_SPLITS)));
  let ring = 0;
  for (let k = 0; k < RADIAL.length - 1; k++) if (f >= RADIAL[k]!) ring = k;
  return sector * (RADIAL.length - 1) + ring;
}

interface Spot {
  a: number;
  f: number;
  x: number;
  z: number;
  y: number;
}

/**
 * Height of the rendered terrain (the coarse chunk triangles, not the smooth height function) at
 * (x, z), for the region whose decorations are being built; set by buildIsland. Things placed with
 * it sit exactly on the ground instead of floating over or sinking into the facets.
 */
let groundAt: ((x: number, z: number) => number) | null = null;

function groundSampler(def: RegionDef, terrain: BufferGeometry[]): (x: number, z: number) => number {
  const mat = new MeshBasicMaterial({ side: DoubleSide });
  const meshes = terrain.map((g) => new Mesh(g, mat));
  const ray = new Raycaster();
  const from = new Vector3();
  const down = new Vector3(0, -1, 0);
  return (x, z) => {
    ray.set(from.set(x, 20, z), down);
    for (const h of ray.intersectObjects(meshes, false)) if (h.face && h.face.normal.y > 0.3) return h.point.y;
    return heightAt(def.env, x, z, Math.hypot(x, z) / islandRadius(Math.atan2(z, x)));
  };
}

function spotAt(def: RegionDef, a: number, f: number): Spot {
  const R = islandRadius(a);
  const x = Math.cos(a) * f * R;
  const z = Math.sin(a) * f * R;
  return { a, f, x, z, y: groundAt ? groundAt(x, z) : heightAt(def.env, x, z, f) };
}

/** Inverse of regionAngle: where angle a lies across the region at radius fraction f (0..1 inside). */
function regionT(def: RegionDef, a: number, f: number): number {
  const e0 = def.a0 + boundaryWobble(def.a0, f);
  const e1 = def.a1 + boundaryWobble(def.a1, f);
  return (a - e0) / (e1 - e0);
}

function scatter(def: RegionDef, r: Rng, n: number, fMin: number, fMax: number, avoid: Spot[], minDist: number): Spot[] {
  const out: Spot[] = [];
  // Keeps clear of the winding channel edges.
  const margin = 0.3;
  for (let tries = 0; out.length < n && tries < n * 40; tries++) {
    const a = range(r, def.a0 + margin, def.a1 - margin);
    const f = range(r, fMin, fMax);
    const s = spotAt(def, a, f);
    if ([...avoid, ...out].some((o) => Math.hypot(o.x - s.x, o.z - s.z) < minDist)) continue;
    out.push(s);
  }
  return out;
}

type Deco = { geometry: BufferGeometry; a: number; f: number };

function glacierDecor(def: RegionDef, r: Rng): Deco[] {
  const out: Deco[] = [];
  const mid = (def.a0 + def.a1) / 2;
  const peak = spotAt(def, mid, 0.5);
  const mountain = (radius: number, height: number, snowLine: number) => {
    const g = new ConeGeometry(radius, height, 7, 3);
    jitter(g, radius * 0.12, r);
    const m = flat(g);
    return paintFaces(m, (c) => (c.y > height * (snowLine - 0.5) ? '#f7faff' : fbm(c.x, c.z, 4) > 0 ? '#6b7089' : '#7c8199'));
  };
  out.push({ geometry: place(mountain(3.1, 5.4, 0.42), [peak.x, peak.y + 2.4, peak.z]), a: mid, f: 0.5 });
  for (const [da, f, rad, h] of [
    [-0.42, 0.74, 1.5, 2.8],
    [0.4, 0.8, 1.3, 2.3],
  ] as const) {
    const s = spotAt(def, mid + da, f);
    out.push({ geometry: place(mountain(rad, h, 0.35), [s.x, s.y + h / 2 - 0.2, s.z]), a: s.a, f });
  }
  for (const s of scatter(def, r, 6, 0.3, 0.92, [peak], 2.2)) {
    const g = r() < 0.5 ? pine(r, 0.9, '#2f7d4a') : place(paint(flat(new ConeGeometry(0.22, 0.9, 5)), '#8fe0fa'), [0, 0.4, 0], [r() * 0.4, 0, r() * 0.4]);
    out.push({ geometry: place(g, [s.x, s.y, s.z]), a: s.a, f: s.f });
  }
  return out;
}

function cityDecor(def: RegionDef, r: Rng): Deco[] {
  const out: Deco[] = [];
  const mid = (def.a0 + def.a1) / 2;
  const colors = ['#ff9e6b', '#7fd3f7', '#ffd23f', '#c9b8f0', '#f4f1ea', '#8fd694'];
  // Roads: one along the bisector, one across it.
  const road = (a: number, f0: number, f1: number) => {
    const s0 = spotAt(def, a, f0);
    const s1 = spotAt(def, a, f1);
    const len = Math.hypot(s1.x - s0.x, s1.z - s0.z);
    const g = box(0.55, 0.04, len, '#5a5f6e');
    const stripe = place(box(0.08, 0.05, len * 0.9, '#f4f1ea'), [0, 0.005, 0]);
    return place(merge([g, stripe]), [(s0.x + s1.x) / 2, 0.52, (s0.z + s1.z) / 2], [0, -Math.atan2(s1.z - s0.z, s1.x - s0.x) + Math.PI / 2, 0]);
  };
  out.push({ geometry: road(mid, 0.12, 0.97), a: mid, f: 0.5 });
  // Gym: the big building with a window showing a tilted board.
  const gymSpot = spotAt(def, mid + 0.2, 0.55);
  const gym = merge([
    place(box(2.6, 1.7, 1.9, '#3a3f58'), [0, 0.85, 0]),
    place(box(2.7, 0.14, 2.0, '#ff4fa3'), [0, 1.72, 0]),
    place(box(2.0, 1.0, 0.04, '#1d3557'), [0, 0.8, 0.96]),
    place(box(1.2, 0.8, 0.04, '#d9a566'), [0, 0.82, 1.0], [-0.35, 0, 0]),
    ...[-0.4, -0.15, 0.1, 0.35].flatMap((x, i) =>
      [0.62, 0.85, 1.05].map((y, j) => place(box(0.07, 0.07, 0.05, ['#ff4fa3', '#3ee0c5', '#ffd23f'][(i + j) % 3]!), [x, y, 1.04 + (y - 0.62) * 0.35])),
    ),
  ]);
  out.push({ geometry: place(gym, [gymSpot.x, gymSpot.y, gymSpot.z], [0, -0.45, 0]), a: gymSpot.a, f: gymSpot.f });
  for (const s of scatter(def, r, 9, 0.22, 0.92, [gymSpot], 1.25)) {
    const h = range(r, 0.8, 2.4);
    const w = range(r, 0.7, 1.2);
    const d = range(r, 0.7, 1.1);
    const c = colors[Math.floor(r() * colors.length)]!;
    const b = merge([
      place(box(w, h, d, c), [0, h / 2, 0]),
      place(box(w + 0.08, 0.1, d + 0.08, '#5a5f6e'), [0, h + 0.03, 0]),
      ...Array.from({ length: Math.max(1, Math.floor(h / 0.5)) }, (_, k) => place(box(w * 0.7, 0.14, 0.03, '#2b4a6f'), [0, 0.35 + k * 0.5, d / 2 + 0.01])),
    ]);
    out.push({ geometry: place(b, [s.x, s.y, s.z], [0, r() * 0.6 - 0.3, 0]), a: s.a, f: s.f });
  }
  for (const s of scatter(def, r, 4, 0.2, 0.9, [], 0.8)) {
    out.push({ geometry: place(tree(r, 0.7), [s.x, s.y, s.z]), a: s.a, f: s.f });
  }
  return out;
}

const STRATA = ['#e8a15a', '#d98446', '#f0b878', '#c96f3b'];

/**
 * A tier of the terrace: a prism over the part of the region between t0..t1 (across it, following
 * the winding channel) and f0..f1 (radius fraction), from y0 up to y1, with strata-banded sides
 * and a grassy top. The rim wobbles a little so it reads as rock.
 */
function terraceTier(def: RegionDef, r: Rng, t0: number, t1: number, f0: number, f1: number, y0: number, y1: number): BufferGeometry {
  const n = 12;
  const seed = Math.floor(r() * 1000);
  const rim = (t: number, f: number): [number, number] => {
    const a = regionAngle(def, t, f);
    const R = islandRadius(a) * (f + 0.03 * fbm(a * 6, f * 6, seed));
    return [Math.cos(a) * R, Math.sin(a) * R];
  };
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    outer.push(rim(t, f1));
    inner.push(rim(t, f0));
  }
  const loop = [...outer, ...inner.reverse()];
  const pos: number[] = [];
  // Top: a strip between the outer and inner arcs.
  for (let i = 0; i < n; i++) {
    const o0 = outer[i]!;
    const o1 = outer[i + 1]!;
    const i0 = loop[loop.length - 1 - i]!;
    const i1 = loop[loop.length - 2 - i]!;
    pos.push(o0[0], y1, o0[1], i0[0], y1, i0[1], o1[0], y1, o1[1]);
    pos.push(o1[0], y1, o1[1], i0[0], y1, i0[1], i1[0], y1, i1[1]);
  }
  // Sides: around the outline.
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1]);
    pos.push(a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  // Faces may be wound either way: turn every top face up and every side face away from the
  // prism's centre line.
  const p = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const mid = rim((t0 + t1) / 2, (f0 + f1) / 2);
  for (let t = 0; t < p.count; t += 3) {
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
    const cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
    const ny = nrm.getY(t);
    if (Math.abs(ny) > 0.5) {
      if (ny < 0) swapWinding(p, t);
      continue;
    }
    const out = (cx - mid[0]) * nrm.getX(t) + (cz - mid[1]) * nrm.getZ(t);
    if (out < 0) swapWinding(p, t);
  }
  g.computeVertexNormals();
  return paintFaces(g, (c, nn) => (nn.y > 0.5 ? (fbm(c.x, c.z, seed) > 0 ? '#9cc95a' : '#b8c96a') : STRATA[Math.abs(Math.floor((c.y - y0) / 0.28)) % STRATA.length]!));
}

function swapWinding(p: BufferAttribute | import('three').InterleavedBufferAttribute, t: number) {
  const x = p.getX(t + 1);
  const y = p.getY(t + 1);
  const z = p.getZ(t + 1);
  p.setXYZ(t + 1, p.getX(t + 2), p.getY(t + 2), p.getZ(t + 2));
  p.setXYZ(t + 2, x, y, z);
}

/** Where the terrace starts across the summer region (t); the farmland stays short of it. */
const TERRACE_T = 0.68;

/**
 * Summer region: a tiered sandstone terrace over its outer-left third (national-park style), and
 * farmland on the rest. The farm is laid out on a grid turned toward the camera: a farmyard with the
 * barn, silo and farmhouse nearest the middle of the island, and fields beyond it. A field is kept
 * only when it lies wholly inside the region and clear of the terrace, and everything is placed on
 * the rendered ground, so nothing overlaps or pokes through the terrain.
 */
function plainsDecor(def: RegionDef, r: Rng): Deco[] {
  const out: Deco[] = [];
  const ground = (x: number, z: number) => (groundAt ? groundAt(x, z) : heightAt(def.env, x, z, 0.5));
  // Terrace: three stacked tiers, each smaller, toward the island's edge. The lowest is sunk well
  // into the ground so its foot never shows a gap where the terrain dips.
  const base = heightAt(def.env, 0, 0, 0.6) - 0.3;
  const tiers: [number, number, number, number, number][] = [
    [TERRACE_T, 0.95, 0.34, 0.93, 0.95],
    [TERRACE_T + 0.05, 0.93, 0.48, 0.9, 0.7],
    [TERRACE_T + 0.1, 0.91, 0.6, 0.87, 0.65],
  ];
  let y = base;
  for (const [t0, t1, f0, f1, h] of tiers) {
    const tm = (t0 + t1) / 2;
    const fm = (f0 + f1) / 2;
    out.push({ geometry: terraceTier(def, r, t0, t1, f0, f1, y, y + h), a: regionAngle(def, tm, fm), f: fm });
    y += h;
  }

  // Farm grid: s runs across the region (toward the terrace), q outward from the island's middle.
  const am = regionAngle(def, 0.33, 0.55);
  const rx = Math.cos(am);
  const rz = Math.sin(am);
  const C = 5.1;
  const at = (s: number, q: number): [number, number] => [rx * (C + q) - rz * s, rz * (C + q) + rx * s];
  const polar = (x: number, z: number) => {
    let a = Math.atan2(z, x);
    if (a < def.a0 - 1) a += Math.PI * 2;
    return { a, f: Math.hypot(x, z) / islandRadius(a) };
  };
  const inside = (s: number, q: number) => {
    const { a, f } = polar(...at(s, q));
    const t = regionT(def, a, f);
    return f > 0.26 && f < 0.88 && t > 0.07 && t < TERRACE_T - 0.1;
  };
  const rectInside = (s: number, q: number, w: number, d: number) =>
    [-1, 0, 1].every((i) => [-1, 0, 1].every((j) => inside(s + (i * w) / 2, q + (j * d) / 2)));
  const deco = (g: BufferGeometry, s: number, q: number) => {
    const { a, f } = polar(...at(s, q));
    out.push({ geometry: g, a, f });
  };
  // Turn so a model's +z (barn doors, house front) faces outward, toward the camera side.
  const yaw = Math.atan2(rx, rz);
  const put = (g: BufferGeometry, s: number, q: number, scale: number, turn = 0) => {
    const [x, z] = at(s, q);
    deco(place(g, [x, ground(x, z), z], [0, yaw + turn, 0], scale), s, q);
  };
  // A patch of ground cover draped over the terrain: fields and the farmyard.
  const patch = (s: number, q: number, w: number, d: number, crop: Crop, rows: number) => {
    const [x, z] = at(s, q);
    deco(field(x, z, w, d, Math.atan2(rx, -rz), crop, ground, rows, 0.04), s, q);
  };

  // Farmyard, with the barn doors, silo and farmhouse facing out over the fields.
  const yardQ = -1.55;
  patch(0, yardQ, 3.3, 1.5, 'yard', 1);
  put(barn(), 0.3, yardQ - 0.05, 0.9);
  put(silo(), 1.2, yardQ - 0.35, 0.78);
  put(farmhouse(), -1.1, yardQ + 0.05, 0.75);
  // A little stack of square bales by the barn.
  for (const [s, q, up] of [
    [1.22, yardQ + 0.36, 0],
    [1.22, yardQ + 0.53, 0],
    [1.22, yardQ + 0.445, 1],
  ] as const) {
    const [x, z] = at(s, q);
    deco(place(box(0.24, 0.12, 0.16, '#e8c547'), [x, ground(x, z) + 0.1 + up * 0.12, z], [0, yaw + 0.1, 0]), s, q);
  }
  // Fence along the yard's field side, open at the barn doors.
  for (const [s0, s1] of [
    [-1.6, -0.2],
    [0.8, 1.6],
  ] as const) {
    const [x0, z0] = at(s0, yardQ + 0.78);
    const [x1, z1] = at(s1, yardQ + 0.78);
    deco(fence(x0, z0, x1, z1, ground, 0.6), (s0 + s1) / 2, yardQ + 0.78);
  }

  // Fields: 1.1 × 1.05 plots with grass paths between, kept only where they fit. Crops that stand
  // out from the grass (no plain green).
  const crops: Crop[] = ['wheat', 'plowed', 'corn', 'wheat', 'wheat', 'plowed', 'corn', 'wheat'];
  const fields: [number, number, number, number, Crop][] = [];
  for (const q of [-0.15, 1.05, 2.25]) {
    for (const sC of [-3.75, -2.5, -1.25, 0, 1.25, 2.5, 3.75]) {
      const w = 1.1;
      const d = 1.05;
      if (!rectInside(sC, q, w, d)) continue;
      const crop = crops[fields.length % crops.length]!;
      patch(sC, q, w, d, crop, crop === 'plowed' ? 6 : 8);
      fields.push([sC, q, w, d, crop]);
    }
  }

  // Trees: a windbreak along the terrace foot, and a few about the farmyard, clear of the fields
  // and the buildings.
  const clear = (s: number, q: number, pad: number) =>
    fields.every(([fs, fq, w, d]) => Math.abs(s - fs) > w / 2 + pad || Math.abs(q - fq) > d / 2 + pad) &&
    !(Math.abs(q - yardQ) < 0.75 + pad && Math.abs(s) < 1.65 + pad);
  for (let i = 0; i < 6; i++) {
    const f = 0.4 + i * 0.09;
    const a = regionAngle(def, TERRACE_T - 0.045, f);
    const R = islandRadius(a) * f;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    out.push({ geometry: place(tree(r, range(r, 0.55, 0.7)), [x, ground(x, z), z]), a, f });
  }
  for (const [s, q] of [
    [-2.3, -1.6],
    [2.35, -1.3],
    [-2.0, -2.3],
  ] as const) {
    if (!inside(s, q) || !clear(s, q, 0.3)) continue;
    put(tree(r, range(r, 0.6, 0.8)), s, q, 1, r() * 3);
  }
  // A loose line of trees out on the meadow beyond the fields, toward the shore.
  let placed = 0;
  for (const [s, q] of [
    [2.9, 3.0],
    [1.7, 3.35],
    [0.3, 3.2],
    [-1.1, 3.1],
    [-2.4, 2.8],
    [3.3, 2.0],
  ] as const) {
    if (placed >= 4) break;
    const { a, f } = polar(...at(s, q));
    const t = regionT(def, a, f);
    if (f > 0.9 || t < 0.08 || t > TERRACE_T - 0.06 || !clear(s, q, 0.35)) continue;
    put(tree(r, range(r, 0.6, 0.8)), s, q, 1, r() * 3);
    placed++;
  }
  return out;
}

function coastDecor(def: RegionDef, r: Rng): Deco[] {
  const out: Deco[] = [];
  const mid = (def.a0 + def.a1) / 2;
  // Sea stack just off the cliffs, carried by the outermost chunk.
  const sa = mid + 0.12;
  const R = islandRadius(sa) + 1.5;
  const sx = Math.cos(sa) * R;
  const sz = Math.sin(sa) * R;
  const stackG = new CylinderGeometry(0.55, 0.75, 3.2, 7, 2);
  jitter(stackG, 0.1, r);
  const stack = merge([
    paintFaces(flat(stackG), (c) => (c.y > 1.2 ? '#c9845c' : '#9a5d44')),
    place(rock(r, 0.5, '#8cc956', 0, 0.15), [0, 1.62, 0], [0, 0, 0], [1.05, 0.35, 1.05]),
  ]);
  out.push({ geometry: place(stack, [sx, 0.1, sz]), a: sa, f: 0.99 });
  for (let k = 0; k < 3; k++) {
    const a = mid + range(r, -0.6, 0.6);
    const rr = islandRadius(a) + range(r, 0.6, 1.4);
    out.push({ geometry: place(rock(r, range(r, 0.25, 0.4), '#9a5d44'), [Math.cos(a) * rr, 0.05, Math.sin(a) * rr]), a, f: 0.99 });
  }
  // Lighthouse on the cliff top: the contact beacon.
  const lh = spotAt(def, mid + 0.25, 0.86);
  out.push({ geometry: place(lighthouse(), [lh.x, lh.y - 0.05, lh.z]), a: lh.a, f: lh.f });

  // The fishing market in the cove: a pier out to sea with boats moored alongside, stalls with
  // striped awnings on the beach, crates of fish and barrels.
  const rim = islandRadius(COVE_A);
  out.push({ geometry: place(pier(3.0, 0.46, 0.32, 0.5), [Math.cos(COVE_A) * rim * 0.93, 0, Math.sin(COVE_A) * rim * 0.93], [0, -COVE_A, 0]), a: COVE_A, f: 0.99 });
  for (const [d, side, color] of [
    [1.3, 1, '#e8423c'],
    [2.3, -1, '#3ee0c5'],
  ] as const) {
    const R = rim * 0.93 + d;
    const px = Math.cos(COVE_A) * R - Math.sin(COVE_A) * 0.55 * side;
    const pz = Math.sin(COVE_A) * R + Math.cos(COVE_A) * 0.55 * side;
    out.push({ geometry: place(fishingBoat(color), [px, 0, pz], [0, -COVE_A + 0.1 * side, 0], 1.35), a: COVE_A, f: 0.99 });
  }
  const market: Spot[] = [];
  for (const [da, f, stripe] of [
    [-0.14, 0.8, '#e8423c'],
    [0.14, 0.8, '#2f86c4'],
  ] as const) {
    const s = spotAt(def, COVE_A + da, f);
    market.push(s);
    out.push({ geometry: place(stall(stripe), [s.x, s.y, s.z], [0, -COVE_A - Math.PI / 2, 0], 0.78), a: s.a, f: s.f });
  }
  for (let k = 0; k < 4; k++) {
    const s = spotAt(def, COVE_A + range(r, -0.08, 0.08), range(r, 0.88, 0.93));
    market.push(s);
    const g = k % 2 ? place(barrel(), [0, 0, 0], [0, 0, 0], 0.3) : place(fishCrate(r), [0, 0, 0], [0, r() * 3, 0], 0.28);
    out.push({ geometry: place(g, [s.x, s.y, s.z]), a: s.a, f: s.f });
  }
  for (const s of scatter(def, r, 6, 0.15, 0.7, [lh, ...market], 1.1)) {
    out.push({ geometry: place(rock(r, range(r, 0.3, 0.45), '#4fae3f', 0, 0.18), [s.x, s.y + 0.18, s.z], [0, 0, 0], [1, 0.8, 1]), a: s.a, f: s.f });
  }
  for (const s of scatter(def, r, 3, 0.75, 0.9, [], 1.5)) {
    out.push({ geometry: place(rock(r, 0.35, '#c9845c'), [s.x, s.y + 0.1, s.z]), a: s.a, f: s.f });
  }
  return out;
}

/** Red-and-white striped lighthouse with a glowing lamp room, base at y = 0. */
function lighthouse(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const bands = 5;
  const H = 1.9;
  for (let k = 0; k < bands; k++) {
    const y0 = (k / bands) * H;
    const r0 = 0.36 - 0.12 * (k / bands);
    const r1 = 0.36 - 0.12 * ((k + 1) / bands);
    parts.push(place(cylinder(r1, r0, H / bands, 10, k % 2 ? '#e8423c' : '#fff8ec'), [0, y0 + H / bands / 2, 0]));
  }
  parts.push(place(cylinder(0.34, 0.34, 0.07, 10, '#2b2d42'), [0, H + 0.03, 0]));
  parts.push(place(cylinder(0.2, 0.2, 0.32, 8, '#ffe27a'), [0, H + 0.23, 0]));
  parts.push(place(cone(0.27, 0.34, 8, '#e8423c'), [0, H + 0.56, 0]));
  parts.push(place(cylinder(0.46, 0.5, 0.16, 10, '#9aa0b0'), [0, 0.08, 0]));
  return merge(parts);
}

/**
 * Centre of the island where the channels meet: a small rock with a trailhead signpost pointing at
 * the four regions. Not part of any region, so it stays put when the others fall.
 */
export function buildHub(): BufferGeometry {
  const r = rng(9090);
  const parts: BufferGeometry[] = [place(rock(r, 0.62, '#9a8f84', 1, 0.12), [0, 0.05, 0], [0, 0, 0], [1, 0.55, 1])];
  parts.push(place(paintFaces(flat(new CylinderGeometry(0.5, 0.56, 0.12, 9)), () => '#8cc956'), [0, 0.36, 0]));
  parts.push(place(cylinder(0.05, 0.06, 1.3, 6, '#7a5230'), [0, 1.0, 0]));
  const signColors = ['#3e8fd6', '#ff4fa3', '#ff8a5b', '#58b83c'];
  REGIONS.forEach((def, i) => {
    const mid = (def.a0 + def.a1) / 2;
    const board = merge([box(0.62, 0.17, 0.05, signColors[i % 4]!), place(cone(0.1, 0.14, 3, signColors[i % 4]!), [0.37, 0, 0], [0, 0, -Math.PI / 2], [1, 1, 0.35])]);
    // Arrow points along +x before rotation; turn it toward the region.
    parts.push(place(board, [0, 1.52 - i * 0.2, 0], [0, -mid, 0]));
    // Offset along the arrow so the board hangs off the post rather than through it.
    const b = parts[parts.length - 1]!;
    b.translate(Math.cos(mid) * 0.3, 0, Math.sin(mid) * 0.3);
  });
  parts.push(place(cone(0.08, 0.14, 6, '#ffd23f'), [0, 1.72, 0]));
  return merge(parts);
}

/** A small sailboat, bow along +x. */
export function buildBoat(): BufferGeometry {
  return merge([
    place(box(1.1, 0.26, 0.42, '#fff8ec'), [0, 0.1, 0]),
    place(box(1.14, 0.08, 0.46, '#e8423c'), [0, -0.02, 0]),
    place(cone(0.21, 0.3, 4, '#fff8ec'), [0.62, 0.1, 0], [0, Math.PI / 4, -Math.PI / 2], [1, 1, 0.9]),
    place(cylinder(0.025, 0.025, 1.3, 5, '#6b4a2e'), [0.05, 0.85, 0]),
    place(paint(flat(new ConeGeometry(0.42, 1.05, 3)), '#ffffff'), [-0.12, 0.85, 0], [0, 0, 0], [0.9, 1, 0.12]),
    place(box(0.14, 0.09, 0.02, '#ffd23f'), [0.1, 1.53, 0]),
  ]);
}

const DECOR: Record<EnvId, (def: RegionDef, r: Rng) => Deco[]> = {
  glacier: glacierDecor,
  gym: cityDecor,
  plains: plainsDecor,
  coast: coastDecor,
};

export function buildIsland(): RegionBuild[] {
  return REGIONS.map((def, ri) => {
    const r = rng(1000 + ri * 31);
    const parts: BufferGeometry[][] = [];
    for (let sector = 0; sector < ANG_SPLITS; sector++) {
      for (let ring = 0; ring < RADIAL.length - 1; ring++) parts.push([buildChunkTerrain(def, sector, ring)]);
    }
    groundAt = groundSampler(def, parts.map((p) => p[0]!));
    for (const d of DECOR[def.env](def, r)) parts[chunkIndex(def, d.a, d.f)]!.push(d.geometry);
    groundAt = null;

    const chunks = parts.map((list, idx): ChunkBuild => {
      const g = merge(list);
      g.translate(def.offset.x, 0, def.offset.z);
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      const center = new Vector3((bb.min.x + bb.max.x) / 2, 0, (bb.min.z + bb.max.z) / 2);
      g.computeBoundingSphere();
      return {
        geometry: g,
        center,
        top: bb.max.y,
        sector: Math.floor(idx / (RADIAL.length - 1)),
        ring: idx % (RADIAL.length - 1),
      };
    });
    return { def, chunks };
  });
}

/** Clouds drifting around the island edges (not over regions). */
export function buildClouds(): { geometry: BufferGeometry; angle: number; radius: number; y: number; speed: number }[] {
  const r = rng(77);
  return Array.from({ length: 6 }, (_, i) => ({
    geometry: cloud(r, range(r, 0.9, 1.4)),
    angle: (i / 6) * Math.PI * 2 + range(r, -0.3, 0.3),
    radius: range(r, 13.5, 16),
    y: range(r, 2.6, 4),
    speed: range(r, 0.008, 0.016) * (r() < 0.5 ? 1 : -1),
  }));
}

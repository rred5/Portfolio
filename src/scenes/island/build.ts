// Island geometry (spec §6.1). Each region is cut into chunks (3 angular × 3 radial) so the regions
// that aren't selected can break apart and fall into the sea during the dive (spec §9.2). Every chunk
// carries the terrain it covers plus the decorations standing on it, merged into one mesh.
import { BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, Vector3, type ColorRepresentation } from 'three';
import type { EnvId } from '../../config/sections';
import { fbm } from '../../lib/noise';
import { rng, range, type Rng } from '../../lib/rng';
import { smoothstep } from '../../lib/ease';
import { box, cloud, flat, jitter, merge, paint, paintFaces, pine, place, rock, tree } from '../../render/geo';
import { islandRadius, REGIONS, type RegionDef } from './layout';

const BOTTOM = -2.4;
const RADIAL = [0.06, 0.4, 0.72, 1.0];
const ANG_SPLITS = 3;

export interface ChunkBuild {
  geometry: BufferGeometry;
  /** Rest position (geometry is centred on it). */
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
      return 0.42 + 0.24 * fbm(x * 0.3, z * 0.3, 5) - 0.14 * smoothstep(0.86, 1, f);
    case 'glacier':
      return 0.75 + 0.3 * fbm(x * 0.3, z * 0.3, 8) - 0.1 * smoothstep(0.9, 1, f);
    case 'gym':
      return 0.5 + 0.03 * fbm(x * 0.5, z * 0.5, 4);
    case 'coast':
      return 0.42 + 1.05 * smoothstep(0.42, 0.96, f) + 0.12 * fbm(x * 0.4, z * 0.4, 6);
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

function buildChunkTerrain(def: RegionDef, sector: number, ring: number): BufferGeometry {
  const env = def.env;
  const a0 = def.a0 + ((def.a1 - def.a0) * sector) / ANG_SPLITS;
  const a1 = def.a0 + ((def.a1 - def.a0) * (sector + 1)) / ANG_SPLITS;
  const f0 = RADIAL[ring]!;
  const f1 = RADIAL[ring + 1]!;
  const na = 4;
  const nf = 3;

  const grid: GridPoint[][] = [];
  for (let i = 0; i <= na; i++) {
    const row: GridPoint[] = [];
    const a = a0 + ((a1 - a0) * i) / na;
    const R = islandRadius(a);
    for (let j = 0; j <= nf; j++) {
      const f = f0 + ((f1 - f0) * j) / nf;
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

  // Side skirts down below the water, with a lip band just under the top edge.
  const skirt = (edge: Vector3[]) => {
    for (let k = 0; k < edge.length - 1; k++) {
      const a = edge[k]!;
      const b = edge[k + 1]!;
      const out = new Vector3((a.x + b.x) / 2 - center.x, 0, (a.z + b.z) / 2 - center.z).normalize();
      const am = new Vector3(a.x, a.y - 0.28, a.z);
      const bm = new Vector3(b.x, b.y - 0.28, b.z);
      const ab = new Vector3(a.x, BOTTOM, a.z);
      const bb = new Vector3(b.x, BOTTOM, b.z);
      tri(a, b, bm, out);
      tri(a, bm, am, out);
      tri(am, bm, bb, out);
      tri(am, bb, ab, out);
    }
  };
  skirt(grid.map((row) => row[nf]!.p));
  skirt(grid.map((row) => row[0]!.p));
  skirt(grid[0]!.map((g) => g.p));
  skirt(grid[na]!.map((g) => g.p));

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

function spotAt(def: RegionDef, a: number, f: number): Spot {
  const R = islandRadius(a);
  const x = Math.cos(a) * f * R;
  const z = Math.sin(a) * f * R;
  return { a, f, x, z, y: heightAt(def.env, x, z, f) };
}

function scatter(def: RegionDef, r: Rng, n: number, fMin: number, fMax: number, avoid: Spot[], minDist: number): Spot[] {
  const out: Spot[] = [];
  const margin = 0.12;
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

function sandstoneTower(r: Rng, height: number, radius: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  let y = 0;
  let rad = radius;
  let k = 0;
  while (y < height) {
    const h = range(r, 0.35, 0.6);
    const g = new CylinderGeometry(rad * range(r, 0.85, 1), rad, h, 7, 1);
    jitter(g, rad * 0.1, r);
    parts.push(place(paint(flat(g), k % 2 ? '#e8a15a' : '#d98a4a'), [0, y + h / 2, 0], [0, r() * 3, 0]));
    y += h;
    rad *= range(r, 0.82, 0.98);
    k++;
  }
  return merge(parts);
}

function plainsDecor(def: RegionDef, r: Rng): Deco[] {
  const out: Deco[] = [];
  const towers = scatter(def, r, 3, 0.35, 0.8, [], 2.4);
  for (const s of towers) {
    out.push({ geometry: place(sandstoneTower(r, range(r, 1.6, 2.6), range(r, 0.45, 0.7)), [s.x, s.y - 0.1, s.z]), a: s.a, f: s.f });
  }
  for (const s of scatter(def, r, 4, 0.2, 0.95, towers, 1.2)) {
    out.push({ geometry: place(rock(r, range(r, 0.3, 0.5), '#e0955a', 0), [s.x, s.y + 0.15, s.z]), a: s.a, f: s.f });
  }
  for (const s of scatter(def, r, 7, 0.15, 0.93, towers, 1.1)) {
    out.push({ geometry: place(tree(r, range(r, 0.7, 1.0)), [s.x, s.y, s.z]), a: s.a, f: s.f });
  }
  for (const s of scatter(def, r, 14, 0.1, 0.95, towers, 0.5)) {
    out.push({ geometry: place(paint(flat(new ConeGeometry(0.12, 0.35, 4)), '#3e9a3a'), [s.x, s.y + 0.15, s.z]), a: s.a, f: s.f });
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
  for (const s of scatter(def, r, 6, 0.15, 0.7, [], 1.1)) {
    out.push({ geometry: place(rock(r, range(r, 0.3, 0.45), '#4fae3f', 0, 0.18), [s.x, s.y + 0.18, s.z], [0, 0, 0], [1, 0.8, 1]), a: s.a, f: s.f });
  }
  for (const s of scatter(def, r, 3, 0.75, 0.9, [], 1.5)) {
    out.push({ geometry: place(rock(r, 0.35, '#c9845c'), [s.x, s.y + 0.1, s.z]), a: s.a, f: s.f });
  }
  return out;
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
    for (const d of DECOR[def.env](def, r)) parts[chunkIndex(def, d.a, d.f)]!.push(d.geometry);

    const chunks = parts.map((list, idx): ChunkBuild => {
      const g = merge(list);
      g.translate(def.offset.x, 0, def.offset.z);
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      const center = new Vector3((bb.min.x + bb.max.x) / 2, 0, (bb.min.z + bb.max.z) / 2);
      g.translate(-center.x, 0, -center.z);
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

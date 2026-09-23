// Relief mesh for natural walls: a grid in wall space, displaced by the wall's surface function,
// flat-shaded with per-face colors. Edges can roll back (rounded boulder sides, cliff tops).
import { BufferAttribute, BufferGeometry, Vector3, type ColorRepresentation } from 'three';
import { smoothstep } from '../../lib/ease';
import { fbm } from '../../lib/noise';
import { paintFaces } from '../../render/geo';
import type { WallDef } from './types';

export interface ReliefOptions {
  u0: number;
  u1: number;
  v0: number;
  /** Top edge (may vary with u). */
  vTop: (u: number) => number;
  nu: number;
  nv: number;
  /** Extra depth offset (negative = rolls away from the viewer), for rounded edges. */
  roll?: (u: number, v: number, vTop: number) => number;
  color: (u: number, v: number, n: Vector3, world: Vector3) => ColorRepresentation;
}

export function reliefMesh(def: WallDef, o: ReliefOptions): BufferGeometry {
  const pts: Vector3[][] = [];
  const uv: [number, number][][] = [];
  for (let i = 0; i <= o.nu; i++) {
    const u = o.u0 + ((o.u1 - o.u0) * i) / o.nu;
    const top = o.vTop(u);
    const col: Vector3[] = [];
    const colUV: [number, number][] = [];
    for (let j = 0; j <= o.nv; j++) {
      const v = o.v0 + ((top - o.v0) * j) / o.nv;
      const d = def.surface(u, v) + (o.roll ? o.roll(u, v, top) : 0);
      col.push(
        new Vector3()
          .copy(def.origin)
          .addScaledVector(def.right, u)
          .addScaledVector(def.up, v)
          .addScaledVector(def.normal, d),
      );
      colUV.push([u, v]);
    }
    pts.push(col);
    uv.push(colUV);
  }

  const pos: number[] = [];
  const faceUV: [number, number][] = [];
  const push = (a: Vector3, b: Vector3, c: Vector3, ua: [number, number], ub: [number, number], uc: [number, number]) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    faceUV.push([(ua[0] + ub[0] + uc[0]) / 3, (ua[1] + ub[1] + uc[1]) / 3]);
  };
  for (let i = 0; i < o.nu; i++) {
    for (let j = 0; j < o.nv; j++) {
      const a = pts[i]![j]!;
      const b = pts[i + 1]![j]!;
      const c = pts[i + 1]![j + 1]!;
      const d = pts[i]![j + 1]!;
      const ua = uv[i]![j]!;
      const ub = uv[i + 1]![j]!;
      const uc = uv[i + 1]![j + 1]!;
      const ud = uv[i]![j + 1]!;
      // Alternate the diagonal for a less regular low-poly look.
      if ((i + j) % 2 === 0) {
        push(a, b, c, ua, ub, uc);
        push(a, c, d, ua, uc, ud);
      } else {
        push(a, b, d, ua, ub, ud);
        push(b, c, d, ub, uc, ud);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  paintFaces(g, (cen, n, f) => {
    const [u, v] = faceUV[f]!;
    return o.color(u, v, n, cen);
  });
  return g;
}

/**
 * Rounded roll-back whose start wobbles along the height, so the sides read as natural rock rather
 * than a straight slab edge.
 */
export function irregularRoll(o: { half: number; band: number; depth: number; amp: number; seed: number; top?: [number, number] }) {
  return (u: number, v: number, vTop: number) => {
    const side = u < 0 ? -1 : 1;
    const start = o.half - o.band + o.amp * fbm(v * 0.45, side * 7.3, o.seed);
    let d = -o.depth * Math.pow(smoothstep(start, start + o.band, Math.abs(u)), 2);
    if (o.top) d -= o.top[1] * Math.pow(smoothstep(vTop - o.top[0], vTop, v), 2);
    return d;
  };
}

/** Rounded roll-back near the given edges. */
export function edgeRoll(opts: { left?: [number, number, number]; right?: [number, number, number]; top?: [number, number] }) {
  return (u: number, v: number, vTop: number) => {
    let d = 0;
    if (opts.left) {
      const [start, end, depth] = opts.left;
      d -= depth * Math.pow(smoothstep(start, end, -u), 2);
    }
    if (opts.right) {
      const [start, end, depth] = opts.right;
      d -= depth * Math.pow(smoothstep(start, end, u), 2);
    }
    if (opts.top) {
      const [band, depth] = opts.top;
      d -= depth * Math.pow(smoothstep(vTop - band, vTop, v), 2);
    }
    return d;
  };
}

/**
 * A free-standing vertical cliff between two ground points (x, z), from y0 up to y1, pushed in and
 * out along its outward normal by noise: side faces of mesas, terrace steps, sea cliffs.
 */
export function cliffFace(
  a: [number, number],
  b: [number, number],
  y0: number,
  y1: number,
  o: { segs: number; rows: number; rough: number; seed: number; color: (y: number, n: Vector3, c: Vector3) => ColorRepresentation },
): BufferGeometry {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  // Outward normal: to the right of a → b, seen from above.
  const nx = -dz / len;
  const nz = dx / len;
  const pt = (i: number, j: number) => {
    const t = i / o.segs;
    const y = y0 + ((y1 - y0) * j) / o.rows;
    const along = t * len;
    const push = o.rough * fbm(along * 0.25, y * 0.25, o.seed) + 0.25 * o.rough * fbm(along * 0.9, y * 0.9, o.seed + 1);
    return new Vector3(a[0] + dx * t + nx * push, y, a[1] + dz * t + nz * push);
  };
  const pos: number[] = [];
  for (let i = 0; i < o.segs; i++) {
    for (let j = 0; j < o.rows; j++) {
      const p00 = pt(i, j);
      const p10 = pt(i + 1, j);
      const p11 = pt(i + 1, j + 1);
      const p01 = pt(i, j + 1);
      for (const p of [p00, p10, p11, p00, p11, p01]) pos.push(p.x, p.y, p.z);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return paintFaces(g, (c, n) => o.color(c.y, n, c));
}

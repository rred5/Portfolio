// Sculpted climbing holds. Smooth-shaded (so the ink pass draws a clean silhouette instead of lines
// across every facet), flat-backed so they sit flush in the wall, with an optional "top" colour on
// upward faces (chalk on rock, snow on ice, a dusting of chalk on plastic).
//
// Each kind is a unit sphere pushed into a recognisable climbing-hold shape: incut jugs with a lip
// and a scoop under it, flat-topped crimps, sloping domes, square-sided pinches, pockets with a
// hollow, horns, long rails, leaning flakes, knobs, ice mushrooms, and two-lobed "dual" holds.
import { BufferAttribute, Color, SphereGeometry, type BufferGeometry, type ColorRepresentation } from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noise2 } from '../../lib/noise';
import type { Rng } from '../../lib/rng';

export type HoldKind = 'jug' | 'crimp' | 'sloper' | 'pinch' | 'pocket' | 'horn' | 'rail' | 'edge' | 'flake' | 'knob' | 'mushroom' | 'blob' | 'dual';

export interface SculptOptions {
  kind: HoldKind;
  /** Width across the wall, metres. */
  size: number;
  color: ColorRepresentation;
  /** Colour on upward-facing surfaces, e.g. chalk. */
  top?: ColorRepresentation;
  /** 0 (none) .. 1 (every upward face). */
  topAmount?: number;
  /** Surface wobble, fraction of the size. */
  rough?: number;
  /** Random brightness variation per hold. */
  vary?: number;
}

type Shape = (x: number, y: number, z: number) => [number, number, number, number];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const flatBack = (z: number) => (z < 0 ? z * 0.1 : z);

// Each shape maps a point on the unit sphere to (x, y, z, hollow): the last value darkens pockets.
const SHAPES: Record<Exclude<HoldKind, 'dual'>, Shape> = {
  jug: (x, y, z) => {
    z = flatBack(z);
    // The top leans out into a lip, with a scoop carved under it.
    const lip = Math.max(0, y) * Math.max(0, z + 0.2);
    let zz = z + 0.55 * lip;
    const yy = y + 0.12 * Math.max(0, z) * Math.max(0, y);
    const scoop = z > 0.25 && y > -0.45 && y < 0.25 ? (1 - Math.abs(y + 0.1) / 0.35) * (z - 0.25) : 0;
    zz -= 0.55 * Math.max(0, scoop);
    return [x, yy * 0.62, zz * 0.62, Math.max(0, scoop) * 1.6];
  },
  crimp: (x, y, z) => {
    z = flatBack(z);
    const yy = y > 0.3 ? 0.3 + (y - 0.3) * 0.12 : y;
    return [x, yy * 0.42, (z + 0.18 * Math.max(0, y)) * 0.4, 0];
  },
  sloper: (x, y, z) => {
    z = z < 0 ? z * 0.1 : z * 0.5;
    return [x, (y - 0.25 * z) * 0.85, z * 0.9, 0];
  },
  pinch: (x, y, z) => {
    const sx = Math.sign(x) * Math.pow(Math.abs(x), 0.6);
    return [sx * 0.42, y, flatBack(z) * 0.55, 0];
  },
  pocket: (x, y, z) => {
    z = z < 0 ? z * 0.1 : z * 0.62;
    const r2 = x * x + y * y * 1.4;
    const dent = z > 0 && r2 < 0.38 ? Math.pow(1 - r2 / 0.38, 1.2) : 0;
    return [x, y * 0.85, z - 0.5 * dent, dent];
  },
  horn: (x, y, z) => {
    z = flatBack(z);
    const spike = z > 0 ? Math.max(0, 1 - (x * x + y * y) * 2.2) : 0;
    return [x * 0.62, (y + 0.35 * spike) * 0.62, (z + 0.9 * spike) * 0.62, 0];
  },
  rail: (x, y, z) => {
    const yy = y > 0.25 ? 0.25 + (y - 0.25) * 0.2 : y;
    return [x * 2.1, yy * 0.38, flatBack(z) * 0.36, 0];
  },
  edge: (x, y, z) => {
    z = flatBack(z);
    return [x * 1.35, y * 0.36, (z + 0.3 * Math.max(0, y) * Math.max(0, z + 0.3)) * 0.34, 0];
  },
  flake: (x, y, z) => {
    // A thin plate whose top stands off the wall.
    const zz = flatBack(z) * 0.2 + 0.28 * (y + 1);
    return [x * 0.9, y * 1.1, zz, 0];
  },
  knob: (x, y, z) => {
    z = flatBack(z);
    const neck = z < 0.35 ? 0.72 + 0.28 * (z / 0.35) : 1;
    return [x * 0.75 * neck, y * 0.75 * neck, z * 0.8, 0];
  },
  mushroom: (x, y, z) => {
    // Ice mushroom: a cap overhanging a narrower stem.
    z = flatBack(z);
    const cap = y > 0 ? 1 + 0.25 * y : 0.78;
    return [x * cap, (y > 0 ? y * 0.8 : y * 0.6), z * 0.7, 0];
  },
  blob: (x, y, z) => [x, y * 0.8, flatBack(z) * 0.5, 0],
};

const base = new Color();
const topC = new Color();
const c = new Color();
const dark = new Color('#1d1d24');

function sculptOne(r: Rng, kind: Exclude<HoldKind, 'dual'>, o: SculptOptions): BufferGeometry {
  const shape = SHAPES[kind];
  const half = o.size / 2;
  const rough = o.rough ?? 0.1;
  const seed = Math.floor(r() * 1e6);
  const ox = r() * 50;
  const oy = r() * 50;

  let g: BufferGeometry = new SphereGeometry(1, 22, 16);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);

  const pos = g.getAttribute('position');
  const hollow = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const n = 1 + rough * (noise2(pos.getX(i) * 1.6 + ox, pos.getY(i) * 1.6 + pos.getZ(i) * 0.9 + oy, seed) + 0.5 * noise2(pos.getX(i) * 3.4 + oy, pos.getY(i) * 3.4 - pos.getZ(i) + ox, seed + 1));
    const [x, y, z, h] = shape(pos.getX(i) * n, pos.getY(i) * n, pos.getZ(i) * n);
    hollow[i] = h;
    pos.setXYZ(i, x * half, y * half, (z + 0.02) * half);
  }
  g.computeVertexNormals();

  base.set(o.color);
  const v = o.vary ?? 0.06;
  base.offsetHSL(0, 0, (r() - 0.5) * 2 * v);
  if (o.top) topC.set(o.top);
  const amount = o.topAmount ?? 0.5;
  const nrm = g.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    c.copy(base);
    if (o.top && amount > 0) {
      const up = nrm.getY(i) + 0.25 * noise2(pos.getX(i) * 30 + ox, pos.getZ(i) * 30, seed + 2);
      c.lerp(topC, clamp((up - (1 - amount)) / 0.2, 0, 1) * 0.85);
    }
    if (hollow[i]! > 0) c.lerp(dark, clamp(hollow[i]! * 1.4, 0, 0.75));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g.toNonIndexed();
}

export function sculptHold(r: Rng, o: SculptOptions): BufferGeometry {
  if (o.kind !== 'dual') return sculptOne(r, o.kind, o);
  // Two lobes of different shape and size, side by side (a "dual-texture" hold).
  const a = sculptOne(r, r() < 0.5 ? 'sloper' : 'jug', { ...o, size: o.size * 0.75 });
  const b = sculptOne(r, r() < 0.5 ? 'crimp' : 'knob', { ...o, size: o.size * 0.5 });
  a.translate(-o.size * 0.18, 0, 0);
  b.translate(o.size * 0.26, o.size * 0.08, 0);
  return mergeGeometries([a, b], false)!;
}

/** Picks a hold kind with the given weights. */
export function pickKind(r: Rng, weights: Partial<Record<HoldKind, number>>): HoldKind {
  const entries = Object.entries(weights) as [HoldKind, number][];
  const total = entries.reduce((t, [, w]) => t + w, 0);
  let x = r() * total;
  for (const [k, w] of entries) {
    x -= w;
    if (x <= 0) return k;
  }
  return entries[0]![0];
}

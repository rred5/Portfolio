// Sculpted climbing holds. Smooth-shaded (so the ink pass draws a clean silhouette instead of lines
// across every facet), flat-backed so they sit flush in the wall, with an optional "top" colour on
// upward faces (chalk on rock, snow on ice, a dusting of chalk on plastic).
import { BufferAttribute, Color, SphereGeometry, type BufferGeometry, type ColorRepresentation } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noise2 } from '../../lib/noise';
import type { Rng } from '../../lib/rng';

export type HoldKind = 'jug' | 'crimp' | 'sloper' | 'pinch' | 'edge' | 'blob';

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

// Width, height, depth relative to `size`; `lean` pushes the top out (incut lip).
const SHAPES: Record<HoldKind, { w: number; h: number; d: number; lean: number }> = {
  jug: { w: 1, h: 0.56, d: 0.52, lean: 0.35 },
  crimp: { w: 1, h: 0.3, d: 0.3, lean: 0.25 },
  sloper: { w: 1, h: 0.72, d: 0.36, lean: -0.1 },
  pinch: { w: 0.46, h: 1, d: 0.46, lean: 0.1 },
  edge: { w: 1.35, h: 0.36, d: 0.34, lean: 0.3 },
  blob: { w: 1, h: 0.8, d: 0.5, lean: 0 },
};

const base = new Color();
const topC = new Color();
const c = new Color();

export function sculptHold(r: Rng, o: SculptOptions): BufferGeometry {
  const s = SHAPES[o.kind];
  const half = o.size / 2;
  const rough = o.rough ?? 0.12;
  const seed = Math.floor(r() * 1e6);
  const ox = r() * 50;
  const oy = r() * 50;

  let g: BufferGeometry = new SphereGeometry(1, 20, 14);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);

  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const n = 1 + rough * (noise2(x * 1.6 + ox, y * 1.6 + z * 0.9 + oy, seed) + 0.5 * noise2(x * 3.4 + oy, y * 3.4 - z + ox, seed + 1));
    x *= n;
    y *= n;
    z *= n;
    // Flat back against the wall, rounded front; the top leans out for incut holds.
    if (z < 0) z *= 0.1;
    z += s.lean * Math.max(0, y) * Math.max(0, z + 0.3);
    pos.setXYZ(i, x * half * s.w, y * half * s.h, (z + 0.02) * half * s.d);
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
      const k = Math.min(1, Math.max(0, (up - (1 - amount)) / 0.2));
      c.lerp(topC, k * 0.85);
    }
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g.toNonIndexed();
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

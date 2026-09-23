// Low-poly geometry helpers. Every built geometry ends up non-indexed with position, normal and
// color attributes only, so pieces can be merged and share the toon material.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
  type ColorRepresentation,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '../lib/rng';

const tmpColor = new Color();

/** Non-indexed, flat normals, no uv. */
export function flat(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute('uv');
  out.deleteAttribute('uv1');
  out.computeVertexNormals();
  return out;
}

/** Paints a color attribute: one color, or a function of vertex position. */
export function paint(
  g: BufferGeometry,
  color: ColorRepresentation | ((p: Vector3, i: number) => ColorRepresentation),
): BufferGeometry {
  const pos = g.getAttribute('position');
  const arr = new Float32Array(pos.count * 3);
  const p = new Vector3();
  if (typeof color !== 'function') tmpColor.set(color);
  for (let i = 0; i < pos.count; i++) {
    if (typeof color === 'function') {
      p.fromBufferAttribute(pos, i);
      tmpColor.set(color(p, i));
    }
    arr[i * 3] = tmpColor.r;
    arr[i * 3 + 1] = tmpColor.g;
    arr[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new BufferAttribute(arr, 3));
  return g;
}

/** Paints each triangle one flat color (keeps the faceted look even with blended vertex colors). */
export function paintFaces(g: BufferGeometry, color: (centroid: Vector3, normal: Vector3, face: number) => ColorRepresentation) {
  const pos = g.getAttribute('position');
  const arr = new Float32Array(pos.count * 3);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  const cen = new Vector3();
  for (let f = 0; f < pos.count / 3; f++) {
    a.fromBufferAttribute(pos, f * 3);
    b.fromBufferAttribute(pos, f * 3 + 1);
    c.fromBufferAttribute(pos, f * 3 + 2);
    cen.copy(a).add(b).add(c).divideScalar(3);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    tmpColor.set(color(cen, n, f));
    for (let k = 0; k < 3; k++) {
      arr[(f * 3 + k) * 3] = tmpColor.r;
      arr[(f * 3 + k) * 3 + 1] = tmpColor.g;
      arr[(f * 3 + k) * 3 + 2] = tmpColor.b;
    }
  }
  g.setAttribute('color', new BufferAttribute(arr, 3));
  return g;
}

/** Moves coincident vertices by the same random offset so the mesh stays closed. */
export function jitter(g: BufferGeometry, amount: number | Vector3, r: Rng): BufferGeometry {
  const pos = g.getAttribute('position');
  const offsets = new Map<string, [number, number, number]>();
  const amt = typeof amount === 'number' ? new Vector3(amount, amount, amount) : amount;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let o = offsets.get(key);
    if (!o) {
      o = [(r() * 2 - 1) * amt.x, (r() * 2 - 1) * amt.y, (r() * 2 - 1) * amt.z];
      offsets.set(key, o);
    }
    pos.setXYZ(i, x + o[0], y + o[1], z + o[2]);
  }
  pos.needsUpdate = true;
  return g;
}

const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler();

export function place(
  g: BufferGeometry,
  pos: Vector3 | [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  scale: number | [number, number, number] = 1,
): BufferGeometry {
  const p = Array.isArray(pos) ? new Vector3(...pos) : pos;
  const s = typeof scale === 'number' ? new Vector3(scale, scale, scale) : new Vector3(...scale);
  q.setFromEuler(e.set(rot[0], rot[1], rot[2]));
  m4.compose(p, q, s);
  g.applyMatrix4(m4);
  return g;
}

export function applyMatrix(g: BufferGeometry, m: Matrix4): BufferGeometry {
  g.applyMatrix4(m);
  return g;
}

export function merge(list: BufferGeometry[]): BufferGeometry {
  const valid = list.filter((g) => g.getAttribute('position')?.count);
  if (!valid.length) return new BufferGeometry();
  for (const g of valid) {
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
    }
    if (!g.getAttribute('color')) paint(g, '#ff00ff');
    if (!g.getAttribute('normal')) g.computeVertexNormals();
  }
  const merged = mergeGeometries(valid, false);
  if (!merged) throw new Error('mergeGeometries failed');
  return merged;
}

// Primitives -------------------------------------------------------------------------------------

/** Jittered low-poly rock/blob. */
export function rock(r: Rng, radius: number, color: ColorRepresentation, detail = 0, rough = 0.25): BufferGeometry {
  const g = new IcosahedronGeometry(radius, detail);
  jitter(g, radius * rough, r);
  return paint(flat(g), color);
}

export function cone(radius: number, height: number, segments: number, color: ColorRepresentation): BufferGeometry {
  return paint(flat(new ConeGeometry(radius, height, segments, 1)), color);
}

export function cylinder(
  rTop: number,
  rBottom: number,
  height: number,
  segments: number,
  color: ColorRepresentation,
): BufferGeometry {
  return paint(flat(new CylinderGeometry(rTop, rBottom, height, segments, 1)), color);
}

export function box(w: number, h: number, d: number, color: ColorRepresentation): BufferGeometry {
  // Built from a cylinder-free BoxGeometry equivalent to keep imports small.
  const g = new BufferGeometry();
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  const v = [
    [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],
    [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
  ] as const;
  const faces = [
    [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0],
  ];
  const pos: number[] = [];
  for (const [a, b, c, dd] of faces) {
    for (const idx of [a, b, c, a, c, dd]) pos.push(...v[idx!]!);
  }
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return paint(g, color);
}

/** Round low-poly tree: trunk + faceted canopy. */
export function tree(r: Rng, scale = 1, canopy: ColorRepresentation = '#4fae3f', trunk: ColorRepresentation = '#7a5230') {
  const t = place(cylinder(0.08, 0.12, 0.6, 5, trunk), [0, 0.3, 0]);
  const c = place(rock(r, 0.5, canopy, 0, 0.18), [0, 0.95, 0], [0, r() * 3, 0], [1, 0.95, 1]);
  const g = merge([t, c]);
  return place(g, [0, 0, 0], [0, 0, 0], scale);
}

/** Pointy pine. */
export function pine(r: Rng, scale = 1, color: ColorRepresentation = '#2f7d4a') {
  const t = place(cylinder(0.06, 0.08, 0.3, 5, '#6b4a2e'), [0, 0.15, 0]);
  const c1 = place(cone(0.42, 0.7, 6, color), [0, 0.6, 0], [0, r() * 3, 0]);
  const c2 = place(cone(0.3, 0.55, 6, color), [0, 0.95, 0], [0, r() * 3, 0]);
  return place(merge([t, c1, c2]), [0, 0, 0], [0, 0, 0], scale);
}

/** Puffy cloud: a few merged blobs, lighter on top. */
export function cloud(r: Rng, scale = 1) {
  const parts: BufferGeometry[] = [];
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const rad = 0.5 + r() * 0.5;
    const g = new IcosahedronGeometry(rad, 1);
    jitter(g, rad * 0.12, r);
    parts.push(place(flat(g), [(i - n / 2) * 0.7 + r() * 0.3, r() * 0.3, r() * 0.4 - 0.2], [0, 0, 0], [1, 0.8, 1]));
  }
  const g = merge(parts.map((p) => paint(p, '#ffffff')));
  paint(g, (p) => (p.y < -0.15 ? '#e3ecf5' : '#ffffff'));
  return place(g, [0, 0, 0], [0, 0, 0], scale);
}

export const up = new Vector3(0, 1, 0);

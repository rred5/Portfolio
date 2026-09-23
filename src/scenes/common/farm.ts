// Farmland pieces, shared by the island's summer region and the view from the Skills terrace: a red
// gambrel barn, a silo, a farmhouse, hay bales, fences, and field patches with crop rows.
import { BufferAttribute, BufferGeometry, CylinderGeometry, SphereGeometry, type ColorRepresentation } from 'three';
import { range, type Rng } from '../../lib/rng';
import { box, cylinder, merge, paint, place, tree } from '../../render/geo';

/** Gambrel-roofed red barn with white trim, 1 unit wide (x), base at y = 0, doors facing +z. */
export function barn(): BufferGeometry {
  const w = 1;
  const d = 1.4;
  const h = 0.62;
  // Gambrel roof profile (x, y) across the width, extruded along z.
  const prof: [number, number][] = [
    [-0.56, h],
    [-0.44, h + 0.3],
    [0, h + 0.46],
    [0.44, h + 0.3],
    [0.56, h],
  ];
  const pos: number[] = [];
  const z0 = -d / 2 - 0.04;
  const z1 = d / 2 + 0.04;
  for (let i = 0; i < prof.length - 1; i++) {
    const [ax, ay] = prof[i]!;
    const [bx, by] = prof[i + 1]!;
    pos.push(ax, ay, z1, bx, by, z1, bx, by, z0, ax, ay, z1, bx, by, z0, ax, ay, z0);
  }
  const roof = new BufferGeometry();
  roof.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  roof.computeVertexNormals();
  paint(roof, '#5b3b3b');
  // Gable ends: the wall area under the roof profile, front and back.
  const gable: number[] = [];
  for (const z of [d / 2, -d / 2]) {
    for (let i = 0; i < prof.length - 1; i++) {
      const [ax, ay] = prof[i]!;
      const [bx, by] = prof[i + 1]!;
      // Wound so the front gable faces +z and the back one −z.
      if (z > 0) gable.push(0, h, z, bx, by, z, ax, ay, z);
      else gable.push(0, h, z, ax, ay, z, bx, by, z);
    }
  }
  const ends = new BufferGeometry();
  ends.setAttribute('position', new BufferAttribute(new Float32Array(gable), 3));
  ends.computeVertexNormals();
  paint(ends, '#c8372d');
  return merge([
    place(box(w, h, d, '#c8372d'), [0, h / 2, 0]),
    roof,
    ends,
    // Doors with the white X trim, and a hay-loft window.
    place(box(0.42, 0.5, 0.02, '#8f2a22'), [0, 0.25, d / 2 + 0.01]),
    place(box(0.46, 0.04, 0.03, '#fff8ec'), [0, 0.5, d / 2 + 0.02]),
    place(box(0.04, 0.64, 0.03, '#fff8ec'), [0, 0.25, d / 2 + 0.02], [0, 0, 0.7]),
    place(box(0.04, 0.64, 0.03, '#fff8ec'), [0, 0.25, d / 2 + 0.02], [0, 0, -0.7]),
    place(box(0.2, 0.16, 0.02, '#fff8ec'), [0, h + 0.18, d / 2 + 0.01]),
  ]);
}

/** Silo: striped cylinder with a domed cap, base at y = 0. */
export function silo(): BufferGeometry {
  return merge([
    place(cylinder(0.24, 0.24, 1.5, 12, '#d9d4c7'), [0, 0.75, 0]),
    place(cylinder(0.245, 0.245, 0.05, 12, '#9aa0b0'), [0, 0.5, 0]),
    place(cylinder(0.245, 0.245, 0.05, 12, '#9aa0b0'), [0, 1.0, 0]),
    place(paint(new SphereGeometry(0.25, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(), '#9aa0b0'), [0, 1.5, 0]),
  ]);
}

/** Small white farmhouse with a red roof and a chimney, base at y = 0. */
export function farmhouse(): BufferGeometry {
  const roof = new CylinderGeometry(0.5, 0.5, 0.9, 3, 1);
  return merge([
    place(box(0.8, 0.5, 0.6, '#f4f1ea'), [0, 0.25, 0]),
    place(paint(roof.toNonIndexed(), '#b8423a'), [0, 0.62, 0], [Math.PI / 2, 0, Math.PI / 2], [1, 1, 0.55]),
    place(box(0.1, 0.25, 0.1, '#8c5a4a'), [0.25, 0.8, -0.1]),
    place(box(0.14, 0.24, 0.02, '#6b4a2e'), [0, 0.12, 0.31]),
    place(box(0.14, 0.12, 0.02, '#7fd3f7'), [-0.24, 0.3, 0.31]),
    place(box(0.14, 0.12, 0.02, '#7fd3f7'), [0.24, 0.3, 0.31]),
  ]);
}

/** Round hay bale lying on its side, radius 1. */
export function hayBale(): BufferGeometry {
  return place(cylinder(1, 1, 1.1, 10, '#e8c547'), [0, 1, 0], [0, 0, Math.PI / 2]);
}

/**
 * Fence line from (x0, z0) to (x1, z1): posts and two rails. `y` is the ground height, or a function
 * giving it, in which case each post stands on the ground and the rails follow the slope.
 */
export function fence(x0: number, z0: number, x1: number, z1: number, y: number | ((x: number, z: number) => number), scale = 1): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const ground = typeof y === 'number' ? () => y : y;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(2, Math.round(len / (0.5 * scale)));
  const ang = Math.atan2(z1 - z0, x1 - x0);
  const posts: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    posts.push([x, ground(x, z), z]);
    parts.push(place(box(0.05 * scale, 0.3 * scale, 0.05 * scale, '#8c6a4a'), [x, posts[i]![1] + 0.15 * scale, z]));
  }
  // Rails run post to post, so they follow the ground.
  for (let i = 0; i < n; i++) {
    const [ax, ay, az] = posts[i]!;
    const [bx, by, bz] = posts[i + 1]!;
    const seg = Math.hypot(bx - ax, bz - az);
    const tilt = Math.atan2(by - ay, seg);
    for (const h of [0.12, 0.24]) {
      parts.push(place(box(seg, 0.03 * scale, 0.03 * scale, '#a07a52'), [(ax + bx) / 2, (ay + by) / 2 + h * scale, (az + bz) / 2], [0, -ang, tilt]));
    }
  }
  return merge(parts);
}

export type Crop = 'wheat' | 'green' | 'plowed' | 'corn' | 'yard';

const CROP: Record<Crop, [ColorRepresentation, ColorRepresentation]> = {
  wheat: ['#e8c547', '#d6ae36'],
  green: ['#7cc24a', '#69ad3c'],
  plowed: ['#a8713f', '#8f5d33'],
  corn: ['#9bcf4f', '#6f9e33'],
  // Packed earth of a farmyard.
  yard: ['#cfae78', '#cfae78'],
};

/**
 * A rectangular field centred at (x, z), its width along the direction `rot` (angle in the xz
 * plane), with crop rows as alternating stripes. `yAt` gives the ground height; the field is cut
 * into small cells that each follow it, lifted by `lift`, so it drapes over the terrain without the
 * ground poking through (or the field z-fighting with it).
 */
export function field(x: number, z: number, w: number, d: number, rot: number, crop: Crop, yAt: (x: number, z: number) => number, rows = 10, lift = 0.02): BufferGeometry {
  const [a, b] = CROP[crop];
  const parts: BufferGeometry[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const at = (lx: number, lz: number): [number, number, number] => {
    const wx = x + lx * c - lz * s;
    const wz = z + lx * s + lz * c;
    return [wx, yAt(wx, wz) + lift, wz];
  };
  const cols = Math.max(1, Math.ceil(w / 0.25));
  const sub = Math.max(1, Math.ceil(d / rows / 0.25));
  for (let i = 0; i < rows; i++) {
    const pos: number[] = [];
    for (let k = 0; k < sub; k++) {
      const z0 = -d / 2 + (d * (i + k / sub)) / rows;
      const z1 = -d / 2 + (d * (i + (k + 1) / sub)) / rows;
      for (let j = 0; j < cols; j++) {
        const x0 = -w / 2 + (w * j) / cols;
        const x1 = -w / 2 + (w * (j + 1)) / cols;
        const p = [at(x0, z0), at(x1, z0), at(x1, z1), at(x0, z1)];
        pos.push(...p[0]!, ...p[2]!, ...p[1]!, ...p[0]!, ...p[3]!, ...p[2]!);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.computeVertexNormals();
    parts.push(paint(g, i % 2 ? a : b));
  }
  return merge(parts);
}

/** A row of round trees along a line (windbreak), each tree `size` tall. */
export function treeRow(r: Rng, x0: number, z0: number, x1: number, z1: number, y: (x: number, z: number) => number, size: number, n: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = x0 + (x1 - x0) * t + range(r, -0.1, 0.1) * size;
    const z = z0 + (z1 - z0) * t + range(r, -0.1, 0.1) * size;
    parts.push(place(tree(r, size * range(r, 0.85, 1.15)), [x, y(x, z), z]));
  }
  return merge(parts);
}

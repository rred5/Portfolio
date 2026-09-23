// Harbour pieces, shared by the island's coast region (the fishing market) and the view from the
// sea cliff: fishing boats, a wooden pier, market stalls, crates of fish and barrels.
import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, type ColorRepresentation } from 'three';
import { range, type Rng } from '../../lib/rng';
import { box, cone, cylinder, merge, paint, place } from '../../render/geo';

/** Hull: a box whose front tapers to a pointed bow; bow along +x, deck at y = h. */
function hull(len: number, w: number, h: number, color: ColorRepresentation, trim: ColorRepresentation): BufferGeometry {
  const L = len / 2;
  const W = w / 2;
  const bow = L + w * 0.55;
  // Outline at deck level and at the keel (narrower), extruded as a simple prism.
  const top: [number, number][] = [
    [-L, -W],
    [L, -W],
    [bow, 0],
    [L, W],
    [-L, W],
  ];
  const bottom = top.map(([x, z]): [number, number] => [x * 0.9, z * 0.6]);
  const pos: number[] = [];
  for (let i = 0; i < top.length; i++) {
    const a = top[i]!;
    const b = top[(i + 1) % top.length]!;
    const c = bottom[(i + 1) % top.length]!;
    const d = bottom[i]!;
    pos.push(a[0], h, a[1], b[0], h, b[1], c[0], 0, c[1], a[0], h, a[1], c[0], 0, c[1], d[0], 0, d[1]);
  }
  for (let i = 1; i < top.length - 1; i++) {
    pos.push(top[0]![0], h, top[0]![1], top[i + 1]![0], h, top[i + 1]![1], top[i]![0], h, top[i]![1]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  // Wooden deck on top, hull colour on the sides; a trim band runs round the rail.
  const deck = new Color('#c98a4f');
  const side = new Color(color);
  const p = g.getAttribute('position');
  const col = new Float32Array(p.count * 3);
  for (let t = 0; t < p.count; t += 3) {
    const c = p.getY(t) === h && p.getY(t + 1) === h && p.getY(t + 2) === h ? deck : side;
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (t + k) * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return merge([g, place(box(len + 0.02, 0.05, w + 0.02, trim), [0, h - 0.03, 0])]);
}

/** Fishing boat: hull, wheelhouse, mast and boom with a net hanging off it. Bow along +x, 1 unit long. */
export function fishingBoat(color: ColorRepresentation = '#e8423c'): BufferGeometry {
  return merge([
    hull(0.62, 0.34, 0.14, color, '#fff8ec'),
    place(box(0.2, 0.16, 0.22, '#fff8ec'), [-0.12, 0.22, 0]),
    place(box(0.24, 0.03, 0.26, '#2f86c4'), [-0.12, 0.31, 0]),
    place(box(0.04, 0.05, 0.15, '#7fd3f7'), [-0.015, 0.23, 0]),
    place(cylinder(0.012, 0.012, 0.5, 5, '#6b4a2e'), [0.12, 0.38, 0]),
    place(cylinder(0.008, 0.008, 0.36, 5, '#6b4a2e'), [0.24, 0.5, 0], [0, 0, -1.0]),
    // Net hanging from the boom, and a couple of floats.
    place(cone(0.07, 0.2, 5, '#3a5a8c'), [0.36, 0.36, 0], [Math.PI, 0, 0]),
    place(box(0.03, 0.03, 0.03, '#ffb400'), [0.3, 0.16, 0.18]),
    place(box(0.03, 0.03, 0.03, '#ffb400'), [0.1, 0.16, 0.18]),
  ]);
}

/** A small rowing boat, bow along +x, 1 unit long. */
export function dinghy(color: ColorRepresentation = '#3ee0c5'): BufferGeometry {
  return merge([hull(0.62, 0.3, 0.1, color, '#fff8ec'), place(box(0.06, 0.02, 0.28, '#c98a4f'), [0, 0.1, 0])]);
}

/** Wooden pier along +x from the origin: plank deck on posts, with a lamp at the end. */
export function pier(len: number, width: number, deckY: number, postDepth: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const n = Math.max(2, Math.round(len / (width * 1.4)));
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * len;
    for (const z of [-width / 2 + 0.03 * width, width / 2 - 0.03 * width]) {
      parts.push(place(cylinder(width * 0.06, width * 0.07, deckY + postDepth, 6, '#6e4c2a'), [x, (deckY - postDepth) / 2, z]));
    }
  }
  // Planks, alternating tones.
  const planks = Math.max(4, Math.round(len / (width * 0.18)));
  for (let k = 0; k < planks; k++) {
    const x = ((k + 0.5) / planks) * len;
    parts.push(place(box(len / planks - 0.01 * width, width * 0.06, width, k % 2 ? '#c98a4f' : '#b8793f'), [x, deckY, 0]));
  }
  parts.push(place(cylinder(width * 0.03, width * 0.03, width * 0.9, 5, '#2b2d42'), [len - width * 0.2, deckY + width * 0.45, width * 0.35]));
  parts.push(place(box(width * 0.12, width * 0.12, width * 0.12, '#ffe27a'), [len - width * 0.2, deckY + width * 0.92, width * 0.35]));
  return merge(parts);
}

/** Market stall: counter, four posts and a striped awning. Front faces +z, 1 unit wide. */
export function stall(stripe: ColorRepresentation): BufferGeometry {
  const parts: BufferGeometry[] = [place(box(1, 0.36, 0.45, '#c98a4f'), [0, 0.18, 0])];
  for (const [x, z] of [
    [-0.46, -0.2],
    [0.46, -0.2],
    [-0.46, 0.2],
    [0.46, 0.2],
  ] as const) {
    parts.push(place(cylinder(0.025, 0.025, 0.8, 5, '#6e4c2a'), [x, 0.4, z]));
  }
  for (let k = 0; k < 6; k++) {
    parts.push(place(box(1.12 / 6, 0.04, 0.62, k % 2 ? '#fff8ec' : stripe), [-0.56 + (k + 0.5) * (1.12 / 6), 0.82, 0.02], [0.25, 0, 0]));
  }
  // Fish laid out on ice on the counter.
  for (let k = 0; k < 4; k++) parts.push(place(box(0.16, 0.03, 0.06, k % 2 ? '#9aa0b0' : '#ff8a5b'), [-0.3 + k * 0.2, 0.38, 0.08], [0, 0.3, 0]));
  return merge(parts);
}

/** Crate of fish: slatted box with fish on top. Unit size. */
export function fishCrate(r: Rng): BufferGeometry {
  const parts: BufferGeometry[] = [place(box(1, 0.55, 0.7, '#c98a4f'), [0, 0.275, 0])];
  for (const y of [0.15, 0.38]) parts.push(place(box(1.02, 0.06, 0.72, '#a8713f'), [0, y, 0]));
  for (let k = 0; k < 5; k++) parts.push(place(box(0.34, 0.08, 0.13, r() < 0.5 ? '#b8bfcc' : '#ff8a5b'), [range(r, -0.3, 0.3), 0.58, range(r, -0.22, 0.22)], [0, range(r, -1, 1), 0]));
  return merge(parts);
}

/** Barrel, unit height. */
export function barrel(): BufferGeometry {
  return merge([
    paint(new CylinderGeometry(0.34, 0.3, 1, 10).toNonIndexed(), '#a8713f').translate(0, 0.5, 0),
    place(cylinder(0.35, 0.35, 0.06, 10, '#2b2d42'), [0, 0.25, 0]),
    place(cylinder(0.35, 0.35, 0.06, 10, '#2b2d42'), [0, 0.75, 0]),
  ]);
}

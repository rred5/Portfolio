// Gym furniture and the neighbouring bouldering wall (spec §7.1): the board's control panel, real
// problems on the neighbour wall, and the things every bouldering gym has lying around.
import { BufferGeometry, CylinderGeometry, Euler, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { range, type Rng } from '../../lib/rng';
import { box, cylinder, merge, paint, place } from '../../render/geo';
import { pickKind, sculptHold } from '../wall/holdShapes';
import { canvasTexture } from '../wall/helpers';

export const PROBLEM_COLORS = ['#ff4fa3', '#35d05a', '#ffd23f', '#29c6f0'] as const;

/** Neighbouring wall: a slightly overhanging panel angled toward the board. */
export const NEIGHBOUR = { center: new Vector3(4.6, 2.3, 0.1), rot: new Euler(0.12, -0.25, 0), w: 3.4, h: 4.6, t: 0.25 };

/** The neighbour wall's frame: u across, v up from its foot, out along the normal. */
export function neighbourFrame() {
  const q = new Quaternion().setFromEuler(NEIGHBOUR.rot);
  const right = new Vector3(1, 0, 0).applyQuaternion(q);
  const up = new Vector3(0, 1, 0).applyQuaternion(q);
  const normal = new Vector3(0, 0, 1).applyQuaternion(q);
  const origin = NEIGHBOUR.center.clone().addScaledVector(normal, NEIGHBOUR.t / 2).addScaledVector(up, -NEIGHBOUR.h / 2);
  return { origin, right, up, normal };
}

/**
 * The neighbour wall with four set problems: each a line of same-coloured holds from a taped
 * start to the top, plus a couple of volumes. Returns the geometry (world space) and the holds of
 * each problem in wall (u, v) coordinates, bottom to top.
 */
export function neighbourWall(r: Rng): { geometry: BufferGeometry; problems: [number, number][][] } {
  const parts: BufferGeometry[] = [box(NEIGHBOUR.w, NEIGHBOUR.h, NEIGHBOUR.t, '#6c7a96')];
  const face = NEIGHBOUR.t / 2;
  // Volumes: wooden and grey triangular prisms bolted to the face.
  for (const [x, y, s, c] of [
    [-0.8, 0.9, 0.55, '#d9a566'],
    [0.9, -0.5, 0.45, '#9aa0b0'],
  ] as const) {
    parts.push(place(paint(new CylinderGeometry(s, s, 0.3, 3).toNonIndexed(), c), [x, y, face + 0.1], [Math.PI / 2, 0, r() * 2]));
  }
  const problems: [number, number][][] = [];
  PROBLEM_COLORS.forEach((color, p) => {
    const lane = -1.2 + p * 0.8;
    const holds: [number, number][] = [];
    for (let k = 0; k < 6; k++) {
      const x = lane + (k % 2 ? 0.18 : -0.18) + range(r, -0.08, 0.08);
      const y = -1.75 + k * 0.7 + range(r, -0.08, 0.08);
      const g = sculptHold(r, { kind: pickKind(r, { jug: 2, crimp: 1, pinch: 1, sloper: 1, pocket: 1 }), size: range(r, 0.12, 0.19), color, top: '#ffffff', topAmount: 0.15, rough: 0.08 });
      parts.push(place(g, [x, y, face], [0, 0, range(r, -0.5, 0.5)]));
      holds.push([x, y + NEIGHBOUR.h / 2]);
    }
    // Start tape under the first hold, and a "top" tag by the last.
    parts.push(place(box(0.1, 0.035, 0.01, color), [holds[0]![0], holds[0]![1] - NEIGHBOUR.h / 2 - 0.16, face + 0.005]));
    parts.push(place(box(0.06, 0.06, 0.01, '#fff8ec'), [holds[0]![0] + 0.09, holds[0]![1] - NEIGHBOUR.h / 2 - 0.16, face + 0.006]));
    parts.push(place(box(0.1, 0.035, 0.01, color), [holds[5]![0] + 0.14, holds[5]![1] - NEIGHBOUR.h / 2 + 0.02, face + 0.005], [0, 0, 0.6]));
    problems.push(holds);
  });
  const g = place(merge(parts), NEIGHBOUR.center, [NEIGHBOUR.rot.x, NEIGHBOUR.rot.y, NEIGHBOUR.rot.z]);
  return { geometry: g, problems };
}

/** Kilter-style control panel on a stand: base, pole, tilted housing. Faces +z before `yaw`. */
export function controlPanel(at: Vector3, yaw: number): { geometry: BufferGeometry; screen: Mesh; touch: Vector3 } {
  const tilt = -0.45;
  const housing = merge([box(0.56, 0.4, 0.06, '#2b2d42'), place(box(0.5, 0.05, 0.08, '#ffd23f'), [0, -0.2, 0.01])]);
  const g = merge([
    place(cylinder(0.24, 0.26, 0.05, 10, '#2b2d42'), [0, 0.025, 0]),
    place(cylinder(0.03, 0.03, 1.1, 6, '#9aa0b0'), [0, 0.6, 0]),
    place(housing, [0, 1.22, 0], [tilt, 0, 0]),
  ]);
  place(g, at, [0, yaw, 0]);

  const tex = canvasTexture(256, 180, (ctx, w, h) => {
    ctx.fillStyle = '#10131f';
    ctx.fillRect(0, 0, w, h);
    // The board, with this problem's lit holds.
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(18, 34, 120, 128);
    const lit: [number, number, string][] = [
      [0.25, 0.85, '#35d05a'],
      [0.3, 0.62, '#29c6f0'],
      [0.22, 0.4, '#29c6f0'],
      [0.55, 0.22, '#29c6f0'],
      [0.85, 0.18, '#ff3fa4'],
    ];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
      ctx.fillStyle = '#5a4630';
      ctx.fillRect(24 + i * 13, 40 + j * 13.5, 4, 4);
    }
    for (const [x, y, c] of lit) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(18 + x * 120, 34 + y * 128, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px Nunito, sans-serif';
    ctx.fillText('SEND IT', 150, 62);
    ctx.fillStyle = '#ffd23f';
    ctx.font = '800 16px Nunito, sans-serif';
    ctx.fillText('V5 · 40°', 150, 88);
    ctx.fillStyle = '#35d05a';
    ctx.fillRect(150, 118, 88, 30);
    ctx.fillStyle = '#10131f';
    ctx.font = '800 15px Nunito, sans-serif';
    ctx.fillText('LIGHT UP', 160, 139);
  });
  const screen = new Mesh(new PlaneGeometry(0.46, 0.32), new MeshBasicMaterial({ map: tex }));
  // Screen sits on the housing's face (housing centre is on the pole axis at 1.22 m).
  const q = new Quaternion().setFromEuler(new Euler(0, yaw, 0)).multiply(new Quaternion().setFromEuler(new Euler(tilt, 0, 0)));
  screen.quaternion.copy(q);
  screen.position.copy(at).add(new Vector3(0, 1.22, 0)).add(new Vector3(0, 0.01, 0.032).applyQuaternion(q));
  const touch = screen.position.clone().add(new Vector3(0.14, -0.04, 0.05).applyQuaternion(q));
  return { geometry: g, screen, touch };
}

/** Bench with water bottles and a towel, hangboard, campus board, shoe cubbies. */
export function gymFurniture(r: Rng): BufferGeometry {
  const parts: BufferGeometry[] = [];
  // Bench against the back wall.
  parts.push(place(box(1.4, 0.07, 0.42, '#c98a4f'), [-3.1, 0.48, -0.1]));
  for (const x of [-3.7, -2.5]) parts.push(place(box(0.08, 0.45, 0.36, '#2b2d42'), [x, 0.24, -0.1]));
  parts.push(place(cylinder(0.05, 0.05, 0.22, 8, '#29c6f0'), [-3.5, 0.63, -0.05]));
  parts.push(place(cylinder(0.04, 0.045, 0.2, 8, '#ff8a3d'), [-3.35, 0.62, -0.02]));
  parts.push(place(box(0.34, 0.05, 0.3, '#ff4fa3'), [-2.8, 0.54, -0.08], [0, 0.3, 0]));
  // Hangboard above the bench: a wooden board with pockets and a jug rail.
  parts.push(place(box(0.72, 0.18, 0.07, '#d9a566'), [-3.1, 2.45, -0.36]));
  for (const x of [-0.24, -0.08, 0.08, 0.24]) parts.push(place(box(0.1, 0.05, 0.02, '#6e4c2a'), [-3.1 + x, 2.47, -0.32]));
  // Campus board: an angled panel with wooden rungs.
  const campus: BufferGeometry[] = [box(1.1, 1.8, 0.05, '#c98a4f')];
  for (let k = 0; k < 7; k++) campus.push(place(box(1.0, 0.03, 0.05, '#8c5a2b'), [0, -0.7 + k * 0.23, 0.05]));
  parts.push(place(merge(campus), [-4.85, 2.35, -0.2], [0.26, 0, 0]));
  // Shoe cubbies on the left, with pairs of shoes in some.
  const shoeColors = ['#ff4fa3', '#6b4eff', '#35d05a', '#ffb400', '#29c6f0'];
  parts.push(place(box(1.9, 1.0, 0.36, '#e8e2d4'), [-5.7, 0.5, 0.05]));
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const x = -6.4 + i * 0.47;
      const y = 0.25 + j * 0.48;
      parts.push(place(box(0.42, 0.42, 0.05, '#3b3f5a'), [x, y, 0.21]));
      if (r() < 0.7) {
        const c = shoeColors[Math.floor(r() * shoeColors.length)]!;
        for (const dx of [-0.08, 0.08]) parts.push(place(paint(new CylinderGeometry(0.05, 0.06, 0.2, 7).toNonIndexed(), c), [x + dx, y - 0.14, 0.26], [Math.PI / 2, 0, 0]));
      }
    }
  }
  return merge(parts);
}

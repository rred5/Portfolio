// The four climbing walls (spec §7). Light-weight: positions, relief and framing only, so the camera
// and the DOM overlay can use them before a scene's geometry has loaded.
import { Vector3 } from 'three';
import type { SectionId } from '../content/types';
import { fbm } from '../lib/noise';
import type { WallDef } from './wall/types';

const DEG = Math.PI / 180;
const gauss = (x: number, w: number) => Math.exp(-(x * x) / (w * w));

// Projects: Kilter-style board, 40° overhang, flat panel.
const KILTER_TILT = 40 * DEG;
export const gymWall: WallDef = {
  section: 'projects',
  origin: new Vector3(0, 0.35, 0),
  right: new Vector3(1, 0, 0),
  up: new Vector3(0, Math.cos(KILTER_TILT), Math.sin(KILTER_TILT)),
  normal: new Vector3(0, -Math.sin(KILTER_TILT), Math.cos(KILTER_TILT)),
  surface: () => 0,
  route: { uSpread: 0.3, vStart: 1.25, vEnd: 3.2, seed: 11, shape: 'up-traverse', lane: [-0.85, -0.75], traverseTo: 0.9 },
  ground: -0.35,
  pelvisMin: 0.72,
  handOffsetV: 0,
  framing: {
    landscape: { u: 0, v: 1.9, d: 0.35, yaw: 16, pitch: 6, fitW: 4.6, fitH: 4.2, fov: 40 },
    portrait: { u: 0, v: 2.0, d: 0.35, yaw: 10, pitch: 6, fitW: 3.55, fitH: 4.6, fov: 42 },
  },
};

/** Huecos (wind-carved pockets) on the terrace face, (u, v, radius). */
const HUECOS: [number, number, number][] = [
  [-2.3, 2.1, 0.2],
  [1.95, 3.25, 0.17],
  [-0.3, 5.7, 0.26],
  [2.7, 1.15, 0.18],
  [-3.2, 3.8, 0.22],
  [0.95, 0.55, 0.15],
  [-4.6, 1.3, 0.28],
  [3.4, 5.2, 0.24],
];

/**
 * Terrace face (national-park sandstone): strata bands that each step back at their base, a deeper
 * set-back tier above the route, two vertical cracks, wind-carved pockets and a broad bulge.
 */
function terraceSurface(u: number, v: number): number {
  const band = 0.6;
  const t = (((v / band) % 1) + 1) % 1;
  const strata = -0.09 * t;
  const tier = -0.35 * smoothstep(5.0, 5.35, v) + 0.12 * gauss(v - 5.05, 0.12);
  const cracks =
    -0.16 * gauss(u + 1.5 - 0.1 * Math.sin(v * 2.1), 0.07) * (v > 0.2 && v < 4.9 ? 1 : 0) -
    0.12 * gauss(u - 1.1 - 0.08 * Math.sin(v * 2.7), 0.06) * (v > 1.0 && v < 4.6 ? 1 : 0);
  let pockets = 0;
  for (const [pu, pv, pr] of HUECOS) pockets -= 0.16 * Math.exp(-((u - pu) ** 2 + (v - pv) ** 2) / (pr * pr));
  return 0.32 * fbm(u * 0.32, v * 0.32, 3) + 0.08 * fbm(u * 1.3, v * 1.3, 4) + strata + tier + cracks + pockets;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Skills: the upper tier of a tall sandstone terrace, starting from a ledge high above the plains.
// The camera sits out over the drop, with the wall on the left and the farmland below on the right.
export const plainsWall: WallDef = {
  section: 'skills',
  origin: new Vector3(0, 0, 0),
  right: new Vector3(1, 0, 0),
  up: new Vector3(0, 1, 0),
  normal: new Vector3(0, 0, 1),
  surface: terraceSurface,
  route: { uSpread: 0.5, vStart: 1.55, vEnd: 3.85, seed: 23, lane: [-0.4, 0.35] },
  ground: 0,
  pelvisMin: 0.92,
  handOffsetV: 0,
  framing: {
    landscape: { u: 1.5, v: 2.55, d: 0.4, yaw: 32, pitch: 11, fitW: 6.0, fitH: 5.0, fov: 38 },
    portrait: { u: 0.9, v: 2.85, d: 0.4, yaw: 28, pitch: 10, fitW: 4.6, fitH: 5.0, fov: 40 },
  },
};

// Experience: steep ice face leaning back 10°.
const ICE_TILT = 10 * DEG;
function iceSurface(u: number, v: number): number {
  const bulges = 0.2 * Math.max(0, fbm(u * 0.9 + 4, v * 0.9, 9));
  return 0.28 * fbm(u * 0.4, v * 0.4, 7) + bulges;
}

export const glacierWall: WallDef = {
  section: 'experience',
  origin: new Vector3(0, 0, 0),
  right: new Vector3(1, 0, 0),
  up: new Vector3(0, Math.cos(ICE_TILT), -Math.sin(ICE_TILT)),
  normal: new Vector3(0, Math.sin(ICE_TILT), Math.cos(ICE_TILT)),
  surface: iceSurface,
  route: { uSpread: 0.45, vStart: 1.95, vEnd: 4.15, seed: 37, lane: [0.25, -0.2] },
  ground: 0,
  pelvisMin: 0.92,
  handOffsetV: -0.42,
  framing: {
    landscape: { u: 1.8, v: 2.6, d: 0.4, yaw: 36, pitch: 11, fitW: 6.4, fitH: 5.2, fov: 38 },
    portrait: { u: 1.0, v: 2.9, d: 0.4, yaw: 30, pitch: 10, fitW: 4.7, fitH: 5.0, fov: 40 },
  },
};

/** Sea cliff: horizontal ledges every ~0.8 m, crevices, a big flake on the left. */
function coastSurface(u: number, v: number): number {
  const band = 0.82;
  const t = (v / band) % 1;
  const ledges = 0.09 * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
  const crevice = -0.12 * gauss(u - 1.3 - 0.1 * Math.sin(v * 1.7), 0.06) * (v > 0.4 && v < 4.4 ? 1 : 0);
  const flake = 0.12 * gauss(u + 1.9, 0.35) * gauss(v - 2.6, 0.8);
  return 0.18 * fbm(u * 0.6 + 11, v * 0.6, 5) + ledges + crevice + flake;
}

// About & Contact: coastal cliff above the ocean, vertical.
export const coastWall: WallDef = {
  section: 'about',
  origin: new Vector3(0, 0, 0),
  right: new Vector3(1, 0, 0),
  up: new Vector3(0, 1, 0),
  normal: new Vector3(0, 0, 1),
  surface: coastSurface,
  route: { uSpread: 0.5, vStart: 1.6, vEnd: 3.5, seed: 53, lane: [-0.25, 0.3] },
  ground: 0,
  pelvisMin: 0.92,
  handOffsetV: 0,
  framing: {
    landscape: { u: 0.6, v: 2.2, d: 0.4, yaw: -30, pitch: 10, fitW: 5.6, fitH: 5.2, fov: 38 },
    portrait: { u: 0.9, v: 2.65, d: 0.4, yaw: -28, pitch: 9, fitW: 4.5, fitH: 4.8, fov: 40 },
  },
};

export const WALLS: Record<SectionId, WallDef> = {
  projects: gymWall,
  experience: glacierWall,
  skills: plainsWall,
  about: coastWall,
};

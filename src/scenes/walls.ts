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

/** Sandstone strata: each band steps back a little at its base, which reads as a ledge line. */
function plainsSurface(u: number, v: number): number {
  const band = 0.55;
  const strata = -0.06 * ((v / band) % 1);
  const cracks =
    -0.13 * gauss(u + 1.55 - 0.08 * Math.sin(v * 2.3), 0.07) * (v > 0.2 && v < 4.1 ? 1 : 0) -
    0.1 * gauss(u - 0.85 - 0.06 * Math.sin(v * 3.1), 0.06) * (v > 1.2 && v < 3.6 ? 1 : 0);
  return 0.2 * fbm(u * 0.55, v * 0.55, 3) + strata + cracks;
}

// Skills: sunny sandstone boulder, vertical.
export const plainsWall: WallDef = {
  section: 'skills',
  origin: new Vector3(0, 0, 0),
  right: new Vector3(1, 0, 0),
  up: new Vector3(0, 1, 0),
  normal: new Vector3(0, 0, 1),
  surface: plainsSurface,
  route: { uSpread: 0.5, vStart: 1.55, vEnd: 3.75, seed: 23, lane: [-0.35, 0.3] },
  ground: 0,
  pelvisMin: 0.92,
  handOffsetV: 0,
  framing: {
    landscape: { u: 0, v: 2.25, d: 0.4, yaw: -12, pitch: 7, fitW: 5.2, fitH: 5.0, fov: 38 },
    portrait: { u: 0, v: 2.75, d: 0.4, yaw: -8, pitch: 7, fitW: 4.1, fitH: 4.6, fov: 40 },
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
    landscape: { u: 0, v: 2.4, d: 0.4, yaw: 14, pitch: 8, fitW: 6.2, fitH: 5.6, fov: 38 },
    portrait: { u: 0, v: 2.9, d: 0.4, yaw: 9, pitch: 8, fitW: 4.4, fitH: 4.8, fov: 40 },
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
    landscape: { u: 0.2, v: 2.0, d: 0.4, yaw: -24, pitch: 6, fitW: 5.0, fitH: 5.2, fov: 38 },
    portrait: { u: 0, v: 2.65, d: 0.4, yaw: -14, pitch: 6, fitW: 4.0, fitH: 4.6, fov: 40 },
  },
};

export const WALLS: Record<SectionId, WallDef> = {
  projects: gymWall,
  experience: glacierWall,
  skills: plainsWall,
  about: coastWall,
};

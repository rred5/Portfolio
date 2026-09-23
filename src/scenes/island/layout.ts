// Island layout (spec §6.1): four quadrant regions around a small central pool, split by water
// channels. The camera looks north (−z) from a ~55° high angle; the glacier (tallest) sits at the
// back so nothing is hidden.
import { Vector3 } from 'three';
import type { EnvId } from '../../config/sections';
import type { SectionId } from '../../content/types';
import { dirFrom, type FramingSet } from '../framing';

export const ISLAND_R0 = 9.2;
/** Water level. */
export const SEA_Y = 0;
/** How far each region is pushed out along its bisector, which opens the channels. */
export const CHANNEL = 0.34;

export function islandRadius(theta: number): number {
  return ISLAND_R0 + 0.8 * Math.sin(3 * theta + 0.5) + 0.55 * Math.sin(5 * theta + 1.3) + 0.3 * Math.sin(9 * theta + 2.1);
}

export interface RegionDef {
  section: SectionId;
  env: EnvId;
  /** Angle range in the xz plane, θ = atan2(z, x). */
  a0: number;
  a1: number;
  /** Channel offset applied to the whole region. */
  offset: Vector3;
  /** Label anchor (world, before hover lift). */
  label: Vector3;
  /** Point the dive rushes toward. */
  focus: Vector3;
}

const PI = Math.PI;

function region(section: SectionId, env: EnvId, a0: number, a1: number, labelF: number, labelY: number, labelTurn = 0, focusY = 1.2): RegionDef {
  const mid = (a0 + a1) / 2;
  const offset = new Vector3(Math.cos(mid), 0, Math.sin(mid)).multiplyScalar(CHANNEL);
  const la = mid + labelTurn;
  const lr = labelF * islandRadius(la);
  const label = new Vector3(Math.cos(la) * lr, labelY, Math.sin(la) * lr).add(offset);
  const fr = 0.5 * islandRadius(mid);
  const focus = new Vector3(Math.cos(mid) * fr, focusY, Math.sin(mid) * fr).add(offset);
  return { section, env, a0, a1, offset, label, focus };
}

export const REGIONS: RegionDef[] = [
  region('experience', 'glacier', -PI, -PI / 2, 0.93, 3.2, -0.28, 2.4),
  region('projects', 'gym', -PI / 2, 0, 0.72, 3.4, 0.12),
  region('about', 'coast', 0, PI / 2, 0.74, 2.9, -0.1),
  region('skills', 'plains', PI / 2, PI, 0.7, 2.5, 0.12),
];

export const regionFor = (section: SectionId) => REGIONS.find((r) => r.section === section)!;

export const islandFraming: FramingSet = {
  landscape: { target: new Vector3(0, 0.4, 0.9), dir: dirFrom(0, 55), fitW: 23, fitH: 17.5, fov: 30 },
  portrait: { target: new Vector3(0, 0.4, 0.6), dir: dirFrom(0, 62), fitW: 21.5, fitH: 19, fov: 30 },
};

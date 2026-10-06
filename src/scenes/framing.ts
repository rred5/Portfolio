import { Vector3 } from 'three';

/** A fixed camera framing: look at `target` from direction `dir`, far enough to fit fitW × fitH. */
export interface Framing {
  target: Vector3;
  dir: Vector3;
  fitW: number;
  fitH: number;
  fov: number;
}

export interface FramingSet {
  landscape: Framing;
  portrait: Framing;
}

const DEG = Math.PI / 180;

/** Direction from yaw (around world up, 0 = +z) and pitch (above horizontal) in degrees. */
export function dirFrom(yawDeg: number, pitchDeg: number): Vector3 {
  const y = yawDeg * DEG;
  const p = pitchDeg * DEG;
  return new Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)).normalize();
}

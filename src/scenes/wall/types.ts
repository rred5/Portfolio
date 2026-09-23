import { Vector3 } from 'three';
import type { SectionId } from '../../content/types';

/**
 * A climbing wall in its own 2D coordinates: u runs right, v runs up from the floor/ledge (v = 0),
 * d is depth out of the wall surface along `normal`. The surface itself can have relief.
 */
export interface WallDef {
  section: SectionId;
  origin: Vector3;
  right: Vector3;
  up: Vector3;
  normal: Vector3;
  /** Relief of the wall surface along the normal, in metres. */
  surface: (u: number, v: number) => number;
  route: {
    /** Holds alternate left/right up to this far from the climbing line. */
    uSpread: number;
    vStart: number;
    vEnd: number;
    seed: number;
    /** Straight up (default), or up one side then across the top to the finish. */
    shape?: 'zigzag' | 'up-traverse';
    /** Climbing line u at the bottom and top of the vertical part (default [0, 0]). */
    lane?: [number, number];
    /** u of the finishing hold for 'up-traverse'. */
    traverseTo?: number;
  };
  /** Lowest v a foot can stand on without a hold (floor, ledge, snow). */
  ground: number;
  /** Pelvis height when standing at the start. */
  pelvisMin: number;
  /** Hand position relative to the hold point (ice axes: the hand grips the shaft below the pick). */
  handOffsetV: number;
  framing: {
    landscape: WallFraming;
    portrait: WallFraming;
  };
}

export interface WallFraming {
  /** Look-at point in wall coordinates. */
  u: number;
  v: number;
  d: number;
  yaw: number;
  pitch: number;
  fitW: number;
  fitH: number;
  fov: number;
}

export function toWorld(def: WallDef, u: number, v: number, d: number, out = new Vector3()): Vector3 {
  const depth = def.surface(u, v) + d;
  return out
    .copy(def.origin)
    .addScaledVector(def.right, u)
    .addScaledVector(def.up, v)
    .addScaledVector(def.normal, depth);
}

/**
 * Extra depth needed at (u, v) to sit on top of the rendered relief. The relief mesh is a coarse
 * triangulation of `surface`, so narrow cracks and strata steps in the function are shallower (or
 * missing) in the mesh; anything placed exactly on the function there would be buried.
 */
export function coverDepth(def: WallDef, u: number, v: number): number {
  const s = def.surface(u, v);
  const top = Math.max(s, def.surface(u + 0.12, v), def.surface(u - 0.12, v), def.surface(u, v + 0.15), def.surface(u, v - 0.15));
  return top - s;
}

/** Surface normal in world space, estimated from the relief. */
export function surfaceNormal(def: WallDef, u: number, v: number, out = new Vector3()): Vector3 {
  const e = 0.03;
  const du = (def.surface(u + e, v) - def.surface(u - e, v)) / (2 * e);
  const dv = (def.surface(u, v + e) - def.surface(u, v - e)) / (2 * e);
  out.copy(def.normal).addScaledVector(def.right, -du).addScaledVector(def.up, -dv).normalize();
  return out;
}

export function wallDirection(def: WallDef, local: Vector3, out = new Vector3()): Vector3 {
  return out
    .set(0, 0, 0)
    .addScaledVector(def.right, local.x)
    .addScaledVector(def.up, local.y)
    .addScaledVector(def.normal, local.z);
}

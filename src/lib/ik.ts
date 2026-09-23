import { Vector3 } from 'three';

const d = new Vector3();
const bend = new Vector3();

/**
 * Two-bone IK in 3D (shoulder → elbow → hand, hip → knee → foot), adapted from the old project's
 * planar solveTwoBone. Unreachable targets clamp to full extension along root → target. The middle
 * joint bends toward `pole` (a world-space point), which is how elbows and knees are pushed outward
 * and away from the wall.
 */
export function solveTwoBone(
  root: Vector3,
  target: Vector3,
  l1: number,
  l2: number,
  pole: Vector3,
  outMid: Vector3,
  outEnd: Vector3,
): void {
  d.subVectors(target, root);
  const dist0 = d.length() || 1e-6;
  const dist = Math.min(Math.max(dist0, Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
  d.divideScalar(dist0);

  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));

  bend.subVectors(pole, root);
  bend.addScaledVector(d, -bend.dot(d));
  if (bend.lengthSq() < 1e-8) bend.set(0, 1, 0).addScaledVector(d, -d.y);
  bend.normalize();

  outEnd.copy(root).addScaledVector(d, dist);
  outMid.copy(root).addScaledVector(d, a).addScaledVector(bend, h);
}

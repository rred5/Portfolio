// Climbing moves (spec §14.3). Moving to a hold is a sequence, not a blend: the feet step up one at
// a time, the body drives up while both hands stay on their holds (so the arms pull and the legs
// push, which the IK shows as bending and straightening), the free hand reaches and latches, then
// the other hand follows. Holds further away are reached one hold at a time.
import { clamp01, easeInOutCubic, lerp } from '../lib/ease';
import type { Pose, Route, Side, Spot } from '../scenes/wall/route';

export type Limb = 'lh' | 'rh' | 'lf' | 'rf';
export const LIMBS: Limb[] = ['lh', 'rh', 'lf', 'rf'];

export interface PoseState {
  pelvis: Spot;
  lean: number;
  lh: Spot;
  rh: Spot;
  lf: Spot;
  rf: Spot;
}

export const copyPose = (p: Pose | PoseState): PoseState => ({
  pelvis: { ...p.pelvis },
  lean: p.lean,
  lh: { ...p.lh },
  rh: { ...p.rh },
  lf: { ...p.lf },
  rf: { ...p.rf },
});

/** How each wall climbs: slab/vertical rock, steep overhang, or ice with axes and crampons. */
export type Flavor = 'rock' | 'overhang' | 'ice';

const FLAVOR: Record<Flavor, { hipIn: number; handArc: number; footArc: number; swing: number; windup: number }> = {
  // Hips in on the drive, hands travel out and over.
  rock: { hipIn: 0.05, handArc: 0.14, footArc: 0.07, swing: 0, windup: 0 },
  // Overhang: hips pulled hard into the wall, and the body swings out after the latch.
  overhang: { hipIn: 0.11, handArc: 0.13, footArc: 0.08, swing: 0.07, windup: 0 },
  // Ice: the axe winds up overhead and out, then swings in; crampons kick in from further out.
  ice: { hipIn: 0.03, handArc: 0.24, footArc: 0.15, swing: 0, windup: 0.2 },
};

export interface Step {
  /** Pose index this step ends in (−1 = the rest pose on the ground). */
  index: number;
  to: PoseState;
  /** The hand that grabs the new hold. */
  reach: Side | null;
  dur: number;
  /** Last step of the current plan (the hold the user picked). */
  final: boolean;
}

export interface MoveTiming {
  move: number;
  through: number;
  reduced: number;
}

export const poseAt = (route: Route, index: number): Pose => (index < 0 ? route.rest : route.poses[index]!);

/** Steps from pose `from` to pose `to`, one hold at a time; reduced motion goes straight there. */
export function planSteps(route: Route, from: number, to: number, timing: MoveTiming, reduced: boolean): Step[] {
  if (from === to) return [];
  if (reduced) {
    const p = poseAt(route, to);
    return [{ index: to, to: copyPose(p), reach: p.reach, dur: timing.reduced, final: true }];
  }
  const dir = to > from ? 1 : -1;
  const steps: Step[] = [];
  for (let i = from + dir; ; i += dir) {
    const p = poseAt(route, i);
    const final = i === to;
    // The hand that grabs pose i's hold moves first (going down: the lower hand goes down first).
    // Back to the rest pose there's no hold to grab; lead with the hand that held the last one.
    const reach = p.reach ?? poseAt(route, i - dir).reach;
    steps.push({ index: i, to: copyPose(p), reach, dur: final ? timing.move : timing.through, final });
    if (final) break;
  }
  return steps;
}

type Window = readonly [number, number];

/** Phase windows as fractions of a step. */
const PHASES: Record<'up' | 'down', { foot1: Window; foot2: Window; pelvis: Window; reach: Window; other: Window }> = {
  // Feet first (step up), then stand up and pull, reach and latch, then the other hand.
  up: { foot1: [0.0, 0.18], foot2: [0.15, 0.33], pelvis: [0.26, 0.68], reach: [0.44, 0.7], other: [0.74, 0.96] },
  // Down: lower on straight arms, move the hand down, then the feet, then the other hand.
  down: { pelvis: [0.04, 0.6], reach: [0.14, 0.42], foot1: [0.44, 0.62], foot2: [0.6, 0.78], other: [0.78, 0.97] },
};

export interface Frame {
  pose: PoseState;
  /** Extra distance out from the wall, for a hand or foot travelling through the air. */
  arc: Record<Limb, number>;
  /** Pelvis depth offset (negative = toward the wall). */
  hipIn: number;
}

export const emptyFrame = (p: Pose | PoseState): Frame => ({ pose: copyPose(p), arc: { lh: 0, rh: 0, lf: 0, rf: 0 }, hipIn: 0 });

/** Step fraction at which the reaching hand grabs its hold. */
export function latchAt(base: PoseState, step: Step): number {
  return (isUp(base, step) ? PHASES.up : PHASES.down).reach[1];
}

const isUp = (base: PoseState, step: Step) => step.to.pelvis.v >= base.pelvis.v - 0.05;
const bump = (t: number, a: number, b: number) => Math.sin(Math.PI * clamp01((t - a) / (b - a)));
const moved = (a: Spot, b: Spot) => Math.hypot(a.u - b.u, a.v - b.v) > 0.02;

/** The climber's pose at fraction t (0..1) of a step that started from `base`. */
export function evalStep(base: PoseState, step: Step, t: number, flavor: Flavor, out: Frame): void {
  const f = FLAVOR[flavor];
  const up = isUp(base, step);
  const W = up ? PHASES.up : PHASES.down;
  const reachLimb: Limb = step.reach === 'R' ? 'rh' : 'lh';
  const otherLimb: Limb = reachLimb === 'rh' ? 'lh' : 'rh';
  // Step up with the foot opposite the reaching hand first: it's the one that pushes.
  const foot1: Limb = reachLimb === 'rh' ? 'lf' : 'rf';
  const foot2: Limb = foot1 === 'lf' ? 'rf' : 'lf';
  const windows: Record<Limb, Window> = { lh: W.other, rh: W.other, lf: W.foot1, rf: W.foot2 };
  windows[reachLimb] = W.reach;
  windows[otherLimb] = W.other;
  windows[foot1] = W.foot1;
  windows[foot2] = W.foot2;
  const to = step.to;
  const side = step.reach === 'L' ? -1 : 1;

  for (const limb of LIMBS) {
    const [w0, w1] = windows[limb];
    const raw = clamp01((t - w0) / (w1 - w0));
    const k = easeInOutCubic(raw);
    const a = base[limb];
    const b = to[limb];
    const o = out.pose[limb];
    o.u = lerp(a.u, b.u, k);
    o.v = lerp(a.v, b.v, k);
    let arc = 0;
    if (moved(a, b)) {
      const hand = limb === 'lh' || limb === 'rh';
      arc = Math.sin(Math.PI * raw) * (hand ? f.handArc : f.footArc);
      // Hands travel up and over; the ice axe winds up overhead before it swings in.
      if (hand) o.v += Math.sin(Math.PI * raw) * (0.05 + (limb === reachLimb ? f.windup : 0));
      else o.v += Math.sin(Math.PI * raw) * 0.04;
    }
    out.arc[limb] = arc;
  }

  const [p0, p1] = W.pelvis;
  const pk = easeInOutCubic(clamp01((t - p0) / (p1 - p0)));
  const P = out.pose.pelvis;
  P.u = lerp(base.pelvis.u, to.pelvis.u, pk);
  P.v = lerp(base.pelvis.v, to.pelvis.v, pk);
  if (up) {
    // Sink onto the feet while stepping up, then a little extra lift at the top of the drive.
    P.v += -0.03 * bump(t, 0, W.foot2[1]) + 0.035 * bump(t, p1 - 0.16, p1 + 0.04);
  }
  // A small sag as the hand latches and takes weight.
  P.v -= 0.025 * bump(t, W.reach[1], W.reach[1] + 0.14);
  // Overhang: the body swings out and back after the latch.
  if (f.swing && t > W.reach[1]) {
    const k = (t - W.reach[1]) / (1 - W.reach[1]);
    P.u += f.swing * side * Math.sin(k * Math.PI * 2.5) * (1 - k);
  }
  out.pose.lean = lerp(base.lean, to.lean, pk) + side * 0.08 * bump(t, W.reach[0], W.reach[1]);
  out.hipIn = -f.hipIn * bump(t, p0, p1 + 0.05);
}

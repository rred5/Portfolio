// Route + pose generation (spec §8.1, §14.3). Interactive holds zig-zag up the wall bottom → top in
// item order. Each gets a predefined pose: which hand grabs it, where the other hand and feet go, and
// where the pelvis sits. Support holds are created wherever those other limbs land, so the climber
// always has something to stand and pull on.
import { rng } from '../../lib/rng';
import type { WallDef } from './types';

export type Side = 'L' | 'R';

export interface Spot {
  u: number;
  v: number;
}

export interface Slot extends Spot {
  hand: Side;
}

/** Limb targets are hold points (for axes: the pick placement, not the hand). */
export interface Pose {
  pelvis: Spot;
  lean: number;
  lh: Spot;
  rh: Spot;
  lf: Spot;
  rf: Spot;
  /** Which hand reaches for the pose's interactive hold (null for the rest pose). */
  reach: Side | null;
}

export interface Route {
  slots: Slot[];
  supports: Spot[];
  rest: Pose;
  poses: Pose[];
}

// Body proportions, shared with the climber rig.
export const BODY = {
  upperArm: 0.31,
  forearm: 0.3,
  thigh: 0.41,
  shin: 0.4,
  torso: 0.5,
  shoulderHalf: 0.19,
  hipHalf: 0.1,
  neck: 0.1,
  headR: 0.19,
};

const SNAP_TO_SLOT = 0.17;
const MERGE = 0.13;

const dist = (a: Spot, b: Spot) => Math.hypot(a.u - b.u, a.v - b.v);

export function buildRoute(n: number, def: WallDef): Route {
  const r = rng(def.route.seed * 97 + n);
  const { uSpread, vStart, vEnd } = def.route;

  const slots: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const side = i % 2 === 0 ? -1 : 1;
    const u = side * uSpread * (0.4 + 0.6 * r());
    const v = vStart + t * (vEnd - vStart) + (r() - 0.5) * 0.12;
    slots.push({ u, v, hand: u >= 0 ? 'R' : 'L' });
  }

  const off = def.handOffsetV;
  const g = def.ground;
  const standFoot = (s: Spot): Spot => (s.v < g + 0.12 ? { u: s.u, v: g } : s);

  const rest: Pose = {
    pelvis: { u: 0, v: def.pelvisMin },
    lean: 0,
    lh: { u: -0.26, v: def.pelvisMin + 0.8 - off },
    rh: { u: 0.26, v: def.pelvisMin + 0.74 - off },
    lf: standFoot({ u: -0.2, v: def.pelvisMin - 0.6 }),
    rf: standFoot({ u: 0.22, v: def.pelvisMin - 0.66 }),
    reach: null,
  };

  const poses = slots.map((slot): Pose => {
    const s = slot.hand === 'R' ? 1 : -1;
    const handV = slot.v + off;
    const pelvis = { u: slot.u - s * 0.26, v: Math.max(def.pelvisMin, handV - 1.02) };
    const chestV = pelvis.v + BODY.torso;
    const other: Spot = { u: pelvis.u - s * 0.34, v: chestV + 0.02 - off };
    const low = standFoot({ u: pelvis.u + s * 0.2, v: pelvis.v - 0.78 });
    const high = standFoot({ u: pelvis.u - s * 0.23, v: pelvis.v - 0.5 });
    const reachSpot = { u: slot.u, v: slot.v };
    return {
      pelvis,
      lean: s * 0.12,
      lh: s > 0 ? other : reachSpot,
      rh: s > 0 ? reachSpot : other,
      lf: s > 0 ? high : low,
      rf: s > 0 ? low : high,
      reach: slot.hand,
    };
  });

  // Snap limb targets onto interactive holds when close, otherwise merge into shared support holds.
  const supports: Spot[] = [];
  const resolve = (spot: Spot, isFoot: boolean): Spot => {
    if (isFoot && spot.v <= g + 1e-6) return spot;
    for (const s of slots) if (dist(s, spot) < SNAP_TO_SLOT) return { u: s.u, v: s.v };
    for (const s of supports) if (dist(s, spot) < MERGE) return s;
    const created = { ...spot };
    supports.push(created);
    return created;
  };
  for (const p of [rest, ...poses]) {
    if (p.reach !== 'L') p.lh = resolve(p.lh, false);
    if (p.reach !== 'R') p.rh = resolve(p.rh, false);
    p.lf = resolve(p.lf, true);
    p.rf = resolve(p.rf, true);
  }

  return { slots, supports, rest, poses };
}

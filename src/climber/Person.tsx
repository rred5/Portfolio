// Background people (the gym's regulars): the climber's cartoon body, posed procedurally with a
// small idle — someone sitting on the pads watching, someone at the board's control panel, someone
// working a problem on the neighbouring wall.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { solveTwoBone } from '../lib/ik';
import { BODY } from '../scenes/wall/route';
import { noInk } from '../state/registry';
import { getState } from '../state/store';
import type { SectionId } from '../content/types';
import { buildRig, placeBody, type BodyJoints } from './Climber';
import type { Outfit } from './outfits';

type V3 = [number, number, number];

/** A wall's frame for someone climbing on it (u right, v up, out along normal). */
export interface WallFrame {
  origin: Vector3;
  right: Vector3;
  up: Vector3;
  normal: Vector3;
}

export type PersonPose =
  /** Sitting at `seat` (pelvis), facing `yaw` (radians about +y, 0 = +z), watching `look`. */
  | { kind: 'sit'; seat: V3; yaw: number; look: V3 }
  /** Standing at `at` (floor), facing `yaw`; the right hand works a screen at `touch`. */
  | { kind: 'stand'; at: V3; yaw: number; touch: V3; look: V3 }
  /** On a wall: hands and feet on holds (wall u, v), pelvis between them. */
  | { kind: 'hang'; wall: WallFrame; pelvis: [number, number]; lh: [number, number]; rh: [number, number]; lf: [number, number]; rf: [number, number] };

const UP = new Vector3(0, 1, 0);
const f = new Vector3();
const r = new Vector3();
const b = new Vector3();
const t = new Vector3();
const pole = new Vector3();
const look = new Vector3();
const basis = new Matrix4();

function joints(): BodyJoints & { xb: Vector3; zb: Vector3 } {
  const v = () => new Vector3();
  return {
    pelvis: v(),
    chest: v(),
    head: v(),
    sh: { L: v(), R: v() },
    hip: { L: v(), R: v() },
    el: { L: v(), R: v() },
    kn: { L: v(), R: v() },
    ha: { L: v(), R: v() },
    ft: { L: v(), R: v() },
    bag: v(),
    yb: v(),
    xb: v(),
    zb: v(),
    torsoQ: new Quaternion(),
  };
}

export function Person({ section, outfit, pose }: { section: SectionId; outfit: Outfit; pose: PersonPose }) {
  const rig = useMemo(() => buildRig(outfit), [outfit]);
  const J = useMemo(joints, []);
  useEffect(() => () => void (rig.chips && noInk.delete(rig.chips)), [rig]);

  useFrame((state) => {
    const s = getState();
    if (s.shown !== section) return;
    const time = s.env.reduced ? 0 : state.clock.elapsedTime;
    const breathe = Math.sin(time * 2 + pose.kind.length) * 0.006;

    if (pose.kind === 'hang') {
      // Working a problem: a slow sway, settling onto one foot then the other.
      const w = pose.wall;
      const at = (u: number, v: number, d: number, out: Vector3) => out.copy(w.origin).addScaledVector(w.right, u).addScaledVector(w.up, v).addScaledVector(w.normal, d);
      const sway = Math.sin(time * 0.8) * 0.06;
      at(pose.pelvis[0] + sway, pose.pelvis[1] - Math.abs(sway) * 0.4, 0.34, J.pelvis);
      at(pose.pelvis[0] + sway * 0.4, pose.pelvis[1] + BODY.torso, 0.3 + breathe, J.chest);
      at(pose.pelvis[0] + sway * 0.4, pose.pelvis[1] + BODY.torso + BODY.neck + BODY.headR * 0.95, 0.33, J.head);
      for (const sd of ['L', 'R'] as const) {
        const sg = sd === 'L' ? -1 : 1;
        J.sh[sd].copy(J.chest).addScaledVector(w.right, sg * BODY.shoulderHalf);
        J.hip[sd].copy(J.pelvis).addScaledVector(w.right, sg * BODY.hipHalf);
        const hand = sd === 'L' ? pose.lh : pose.rh;
        const foot = sd === 'L' ? pose.lf : pose.rf;
        at(hand[0], hand[1], 0.07, J.ha[sd]);
        pole.copy(J.sh[sd]).addScaledVector(w.up, -0.5).addScaledVector(w.right, sg * 0.6).addScaledVector(w.normal, 0.5);
        solveTwoBone(J.sh[sd], J.ha[sd], BODY.upperArm, BODY.forearm, pole, J.el[sd], J.ha[sd]);
        at(foot[0], foot[1], 0.08, J.ft[sd]);
        pole.copy(J.hip[sd]).addScaledVector(w.right, sg * 0.9).addScaledVector(w.normal, 0.6).addScaledVector(w.up, 0.2);
        solveTwoBone(J.hip[sd], J.ft[sd], BODY.thigh, BODY.shin, pole, J.kn[sd], J.ft[sd]);
      }
      frameTorso(J, w.normal);
      J.bag.copy(J.pelvis).addScaledVector(J.yb, 0.02).addScaledVector(J.zb, 0.2);
      placeBody(rig, J, outfit, breathe, w.right, w.up, w.normal);
      look.copy(J.ha.R).lerp(J.ha.L, 0.5 + 0.5 * Math.sin(time * 0.35)).addScaledVector(w.up, 0.5).addScaledVector(w.normal, -0.6);
      rig.head.up.copy(w.up);
      rig.head.lookAt(look);
      return;
    }

    // Standing or sitting, facing yaw: forward f, right r, back b.
    f.set(Math.sin(pose.yaw), 0, Math.cos(pose.yaw));
    b.copy(f).negate();
    r.crossVectors(UP, b);
    if (pose.kind === 'sit') {
      J.pelvis.set(...pose.seat);
      // Leaning forward a little, forearms on the knees, watching.
      t.copy(UP).multiplyScalar(0.95).addScaledVector(f, 0.18).normalize();
      J.chest.copy(J.pelvis).addScaledVector(t, BODY.torso).addScaledVector(UP, breathe);
      for (const sd of ['L', 'R'] as const) {
        const sg = sd === 'L' ? -1 : 1;
        J.hip[sd].copy(J.pelvis).addScaledVector(r, sg * BODY.hipHalf);
        J.ft[sd].copy(J.pelvis).addScaledVector(f, 0.5).addScaledVector(r, sg * 0.17).setY(pose.seat[1] - 0.55);
        pole.copy(J.hip[sd]).addScaledVector(UP, 0.8).addScaledVector(f, 0.4);
        solveTwoBone(J.hip[sd], J.ft[sd], BODY.thigh, BODY.shin, pole, J.kn[sd], J.ft[sd]);
      }
    } else {
      J.pelvis.set(pose.at[0], pose.at[1] + 0.86, pose.at[2]).addScaledVector(UP, Math.sin(time * 1.1) * 0.005);
      J.chest.copy(J.pelvis).addScaledVector(UP, BODY.torso + breathe).addScaledVector(f, 0.03);
      for (const sd of ['L', 'R'] as const) {
        const sg = sd === 'L' ? -1 : 1;
        J.hip[sd].copy(J.pelvis).addScaledVector(r, sg * BODY.hipHalf);
        J.ft[sd].set(pose.at[0], pose.at[1] + 0.07, pose.at[2]).addScaledVector(r, sg * 0.13).addScaledVector(f, sd === 'L' ? 0.05 : -0.03);
        pole.copy(J.hip[sd]).addScaledVector(f, 0.8);
        solveTwoBone(J.hip[sd], J.ft[sd], BODY.thigh, BODY.shin, pole, J.kn[sd], J.ft[sd]);
      }
    }
    t.subVectors(J.chest, J.pelvis).normalize();
    J.head.copy(J.chest).addScaledVector(t, BODY.neck + BODY.headR * 0.95);
    for (const sd of ['L', 'R'] as const) {
      const sg = sd === 'L' ? -1 : 1;
      J.sh[sd].copy(J.chest).addScaledVector(r, sg * BODY.shoulderHalf);
      if (pose.kind === 'sit') {
        // Forearms resting on the knees.
        J.ha[sd].copy(J.kn[sd]).addScaledVector(UP, 0.06).addScaledVector(f, 0.08).addScaledVector(r, -sg * 0.05);
        pole.copy(J.sh[sd]).addScaledVector(r, sg * 0.5).addScaledVector(UP, -0.4);
      } else if (sd === 'R') {
        // Tapping through problems on the screen.
        J.ha.R.set(...pose.touch).addScaledVector(UP, Math.max(0, Math.sin(time * 3.1)) * 0.03).addScaledVector(r, Math.sin(time * 0.7) * 0.04);
        pole.copy(J.sh.R).addScaledVector(r, 0.4).addScaledVector(UP, -0.6);
      } else {
        J.ha.L.copy(J.sh.L).addScaledVector(UP, -0.56).addScaledVector(r, -0.1).addScaledVector(f, 0.04);
        pole.copy(J.sh.L).addScaledVector(b, 0.5).addScaledVector(UP, -0.3);
      }
      solveTwoBone(J.sh[sd], J.ha[sd], BODY.upperArm, BODY.forearm, pole, J.el[sd], J.ha[sd]);
    }
    frameTorso(J, b);
    J.bag.copy(J.pelvis).addScaledVector(J.yb, 0.02).addScaledVector(J.zb, 0.2);
    placeBody(rig, J, outfit, breathe, r, UP, b);
    look.set(...pose.look).addScaledVector(UP, Math.sin(time * 0.5) * 0.15);
    rig.head.up.copy(UP);
    rig.head.lookAt(look);
  });

  return <primitive object={rig.root} />;
}

/** Torso basis (x across the shoulders, y up the spine, z out of the back). */
function frameTorso(J: BodyJoints & { xb: Vector3; zb: Vector3 }, back: Vector3) {
  J.yb.subVectors(J.chest, J.pelvis).normalize();
  J.xb.subVectors(J.sh.R, J.sh.L).normalize();
  J.zb.crossVectors(J.xb, J.yb).normalize();
  if (J.zb.dot(back) < 0) J.zb.negate();
  J.xb.crossVectors(J.yb, J.zb).normalize();
  basis.makeBasis(J.xb, J.yb, J.zb);
  J.torsoQ.setFromRotationMatrix(basis);
}

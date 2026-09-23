// The climber (spec §14): a joint rig (pelvis → chest → head, shoulders → elbows → hands,
// hips → knees → feet) driven by authored poses per hold. Limbs are solved with two-bone IK; body
// parts are toon-shaded low-poly pieces placed on the joints every frame.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  SphereGeometry,
  TetrahedronGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { motion } from '../config/motion';
import { clamp01, easeInOutCubic, lerp } from '../lib/ease';
import { solveTwoBone } from '../lib/ik';
import { box, flat, merge, paint, place } from '../render/geo';
import { toon, toonVC } from '../render/toon';
import type { WallLayout } from '../scenes/layouts';
import { BODY, type Pose, type Side, type Spot } from '../scenes/wall/route';
import { toWorld } from '../scenes/wall/types';
import { noInk } from '../state/registry';
import { getState } from '../state/store';
import type { Outfit } from './outfits';

// Depths out from the wall surface.
const D = { pelvis: 0.36, chest: 0.3, head: 0.33, hand: 0.07, foot: 0.08 };

type Limb = 'lh' | 'rh' | 'lf' | 'rf';
const LIMBS: Limb[] = ['lh', 'rh', 'lf', 'rf'];

interface PoseState {
  pelvis: Spot;
  lean: number;
  lh: Spot;
  rh: Spot;
  lf: Spot;
  rf: Spot;
}

const copyPose = (p: Pose | PoseState): PoseState => ({
  pelvis: { ...p.pelvis },
  lean: p.lean,
  lh: { ...p.lh },
  rh: { ...p.rh },
  lf: { ...p.lf },
  rf: { ...p.rf },
});

const unitCyl = new CylinderGeometry(1, 1, 1, 7, 1);
const unitBall = flat(new IcosahedronGeometry(1, 1));
const Y = new Vector3(0, 1, 0);
const q = new Quaternion();
const tmp = new Vector3();
const tmp2 = new Vector3();
const basis = new Matrix4();

function segment(mesh: Object3D, a: Vector3, b: Vector3, r: number) {
  tmp.subVectors(b, a);
  const len = tmp.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  q.setFromUnitVectors(Y, tmp.divideScalar(len || 1));
  mesh.quaternion.copy(q);
  mesh.scale.set(r, len, r);
}

function makeMesh(geo: BufferGeometry, mat: Material, parent: Group) {
  const m = new Mesh(geo, mat);
  m.castShadow = true;
  parent.add(m);
  return m;
}

interface Rig {
  root: Group;
  torso: Mesh;
  hips: Mesh;
  head: Group;
  upperArm: Record<'L' | 'R', Mesh>;
  sleeve: Record<'L' | 'R', Mesh | null>;
  forearm: Record<'L' | 'R', Mesh>;
  elbow: Record<'L' | 'R', Mesh>;
  hand: Record<'L' | 'R', Mesh>;
  thigh: Record<'L' | 'R', Mesh>;
  shin: Record<'L' | 'R', Mesh>;
  knee: Record<'L' | 'R', Mesh>;
  foot: Record<'L' | 'R', Mesh>;
  chalk: Mesh | null;
  axes: Record<'L' | 'R', Group> | null;
  chips: InstancedMesh | null;
}

function buildRig(o: Outfit): Rig {
  const root = new Group();
  root.name = 'climber';
  const puffy = o.sleeves === 'puffy';
  const skin = toon(o.skin);
  const shirt = toon(o.shirt);
  const pants = toon(o.pants);
  const armMat = o.sleeves === 'long' || puffy ? shirt : skin;
  const handMat = toon(o.gloves ?? o.skin);
  const shinMat = o.legs === 'long' ? pants : skin;

  const torso = makeMesh(unitBall, shirt, root);
  const hips = makeMesh(unitBall, pants, root);

  const head = new Group();
  root.add(head);
  const skull = new Mesh(flat(new IcosahedronGeometry(BODY.headR, 1)), skin);
  skull.castShadow = true;
  head.add(skull);
  const capGeo = flat(new SphereGeometry(BODY.headR * 1.06, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.55));
  if (o.helmet) {
    const helmet = new Mesh(flat(new SphereGeometry(BODY.headR * 1.18, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.52)), toon(o.helmet));
    helmet.position.y = 0.02;
    helmet.castShadow = true;
    head.add(helmet);
  } else {
    const hair = new Mesh(capGeo, toon(o.hair));
    hair.rotation.x = -0.35;
    hair.position.set(0, 0.02, -0.02);
    head.add(hair);
  }
  const eyeGeo = new SphereGeometry(0.022, 6, 4);
  for (const x of [-0.065, 0.065]) {
    const eye = new Mesh(eyeGeo, toon('#151515'));
    eye.position.set(x, 0.02, BODY.headR * 0.92);
    head.add(eye);
  }

  const side = <T,>(f: (s: 'L' | 'R') => T): Record<'L' | 'R', T> => ({ L: f('L'), R: f('R') });
  const upperArm = side(() => makeMesh(unitCyl, armMat, root));
  const sleeve = side(() => (o.sleeves === 'short' ? makeMesh(unitCyl, shirt, root) : null));
  const forearm = side(() => makeMesh(unitCyl, puffy ? shirt : skin, root));
  const elbow = side(() => makeMesh(unitBall, puffy ? shirt : skin, root));
  const hand = side(() => makeMesh(unitBall, handMat, root));
  const thigh = side(() => makeMesh(unitCyl, pants, root));
  const shin = side(() => makeMesh(unitCyl, shinMat, root));
  const knee = side(() => makeMesh(unitBall, o.legs === 'long' ? pants : skin, root));
  const shoeGeo = merge([
    paint(flat(new IcosahedronGeometry(1, 1)), o.shoes),
    place(paint(flat(new IcosahedronGeometry(1, 1)), o.sole), [0, -0.45, 0], [0, 0, 0], [0.95, 0.5, 0.95]),
    ...(o.crampons ? [place(box(1.6, 0.3, 2.2, '#b8bfcc'), [0, -0.8, 0])] : []),
  ]);
  const foot = side(() => makeMesh(shoeGeo, toonVC(), root));

  const chalk = o.chalkBag ? makeMesh(flat(new CylinderGeometry(0.075, 0.065, 0.11, 7)), toon(o.chalkBag), root) : null;

  let axes: Rig['axes'] = null;
  let chips: InstancedMesh | null = null;
  if (o.axes) {
    const axeGeo = merge([
      place(paint(flat(new CylinderGeometry(0.03, 0.034, 1, 6)), '#2b2d42'), [0, 0.5, 0]),
      place(box(0.07, 0.07, 0.36, '#c9d2e0'), [0, 1.0, -0.08]),
      place(box(0.07, 0.07, 0.1, '#c9d2e0'), [0, 1.0, 0.1]),
      place(box(0.07, 0.16, 0.07, '#ff5a36'), [0, 0.1, 0]),
    ]);
    axes = side(() => {
      const g = new Group();
      const m = new Mesh(axeGeo, toonVC());
      m.castShadow = true;
      g.add(m);
      root.add(g);
      return g;
    });
    chips = new InstancedMesh(flat(new TetrahedronGeometry(0.03)), toon('#c8f0ff'), 12);
    chips.frustumCulled = false;
    chips.count = 0;
    root.add(chips);
    noInk.add(chips);
  }

  return { root, torso, hips, head, upperArm, sleeve, forearm, elbow, hand, thigh, shin, knee, foot, chalk, axes, chips };
}

interface Chip {
  p: Vector3;
  v: Vector3;
  age: number;
}

export function Climber({ layout, outfit }: { layout: WallLayout; outfit: Outfit }) {
  const { def, route } = layout;
  const rig = useMemo(() => buildRig(outfit), [outfit]);
  const anim = useRef({
    cur: copyPose(route.rest),
    from: copyPose(route.rest),
    to: copyPose(route.rest),
    reach: null as Side | null,
    t0: -1,
    dur: motion.pose as number,
    targetId: undefined as string | undefined,
    idleSince: 0,
    nextChalk: 7,
    chalk: -1,
    chalkHand: 'L' as Side,
    landed: true,
    tick: 0,
    chips: [] as Chip[],
  });

  useEffect(() => () => {
    if (rig.chips) noInk.delete(rig.chips);
  }, [rig]);

  // World-space joint scratch.
  const J = useMemo(
    () => ({
      pelvis: new Vector3(),
      chest: new Vector3(),
      neck: new Vector3(),
      head: new Vector3(),
      sh: { L: new Vector3(), R: new Vector3() },
      hip: { L: new Vector3(), R: new Vector3() },
      el: { L: new Vector3(), R: new Vector3() },
      kn: { L: new Vector3(), R: new Vector3() },
      ha: { L: new Vector3(), R: new Vector3() },
      ft: { L: new Vector3(), R: new Vector3() },
      hold: { L: new Vector3(), R: new Vector3() },
      pole: new Vector3(),
      look: new Vector3(),
    }),
    [],
  );

  useFrame((state, dt) => {
    const s = getState();
    if (s.shown !== def.section) {
      // Reset to the rest pose whenever the section isn't on screen (spec §9.3).
      const a = anim.current;
      if (a.targetId !== undefined || a.t0 !== -1) {
        a.cur = copyPose(route.rest);
        a.from = copyPose(route.rest);
        a.to = copyPose(route.rest);
        a.targetId = undefined;
        a.reach = null;
        a.t0 = -1;
        a.chalk = -1;
      }
      return;
    }
    const a = anim.current;
    const now = state.clock.elapsedTime;
    const reduced = s.env.reduced;

    // New target?
    const targetId = s.climberItem[def.section];
    if (targetId !== a.targetId) {
      a.targetId = targetId;
      const idx = targetId ? layout.slotOf.get(targetId) : undefined;
      const pose = idx !== undefined ? route.poses[idx]! : route.rest;
      a.from = copyPose(a.cur);
      a.to = copyPose(pose);
      a.reach = pose.reach;
      const travel = Math.hypot(pose.pelvis.u - a.cur.pelvis.u, pose.pelvis.v - a.cur.pelvis.v);
      a.dur = reduced ? motion.poseReduced : travel > motion.longMove ? motion.poseLong : motion.pose;
      a.t0 = now;
      a.idleSince = now + a.dur;
      a.chalk = -1;
      a.landed = false;
    }

    // Blend.
    const t = a.t0 < 0 ? 1 : clamp01((now - a.t0) / a.dur);
    const e = easeInOutCubic(t);
    a.cur.pelvis.u = lerp(a.from.pelvis.u, a.to.pelvis.u, e);
    a.cur.pelvis.v = lerp(a.from.pelvis.v, a.to.pelvis.v, e);
    a.cur.lean = lerp(a.from.lean, a.to.lean, e);
    const limbT: Record<Limb, number> = { lh: 0, rh: 0, lf: 0, rf: 0 };
    LIMBS.forEach((limb, i) => {
      const isReach = (limb === 'lh' && a.reach === 'L') || (limb === 'rh' && a.reach === 'R');
      const delay = isReach ? 0.1 : (i * 0.025) / Math.max(a.dur, 0.01);
      const lt = easeInOutCubic(clamp01((t - delay) / (1 - delay)));
      limbT[limb] = lt;
      a.cur[limb].u = lerp(a.from[limb].u, a.to[limb].u, lt);
      a.cur[limb].v = lerp(a.from[limb].v, a.to[limb].v, lt);
    });

    // Glacier: axe "tick" when the reaching hand lands.
    if (!a.landed && t >= 1) {
      a.landed = true;
      if (rig.axes && a.reach && !reduced) {
        a.tick = now;
        const hold = a.reach === 'L' ? a.cur.lh : a.cur.rh;
        const p = toWorld(def, hold.u, hold.v, 0.05);
        for (let i = 0; i < 7; i++) {
          a.chips.push({
            p: p.clone(),
            v: new Vector3().copy(def.normal).multiplyScalar(0.6 + Math.random() * 0.6).add(tmp2.set((Math.random() - 0.5) * 1.2, Math.random() * 0.8, 0)),
            age: 0,
          });
        }
      }
    }

    // Idle: occasional chalk dip with the non-reaching hand (not on the glacier).
    if (rig.chalk && !reduced && t >= 1) {
      if (a.chalk < 0 && now - a.idleSince > motion.chalkIdleDelay && now > a.nextChalk) {
        a.chalk = now;
        a.chalkHand = a.reach === 'L' ? 'R' : 'L';
      }
    }
    let chalkW = 0;
    if (a.chalk >= 0) {
      const ct = (now - a.chalk) / motion.chalkDuration;
      if (ct >= 1) {
        a.chalk = -1;
        a.idleSince = now;
        a.nextChalk = now + motion.chalkEvery[0] + Math.random() * (motion.chalkEvery[1] - motion.chalkEvery[0]);
      } else {
        chalkW = ct < 0.4 ? easeInOutCubic(ct / 0.4) : ct < 0.6 ? 1 : 1 - easeInOutCubic((ct - 0.6) / 0.4);
      }
    }

    // --- Solve joints ---------------------------------------------------------------------------
    const cur = a.cur;
    const breathe = reduced ? 0 : Math.sin(now * 2.1) * 0.006;
    const lean = cur.lean;
    const ul = Math.hypot(lean, 1);
    const upU = lean / ul;
    const upV = 1 / ul;
    const rtU = upV;
    const rtV = -upU;
    const P = cur.pelvis;
    const C = { u: P.u + upU * BODY.torso, v: P.v + upV * BODY.torso };
    toWorld(def, P.u, P.v, D.pelvis, J.pelvis);
    toWorld(def, C.u, C.v, D.chest + breathe, J.chest);
    toWorld(def, C.u + upU * BODY.neck, C.v + upV * BODY.neck, D.chest, J.neck);
    toWorld(def, C.u + upU * (BODY.neck + BODY.headR * 0.95), C.v + upV * (BODY.neck + BODY.headR * 0.95), D.head, J.head);
    for (const sd of ['L', 'R'] as const) {
      const sg = sd === 'L' ? -1 : 1;
      toWorld(def, C.u + rtU * BODY.shoulderHalf * sg, C.v + rtV * BODY.shoulderHalf * sg, D.chest, J.sh[sd]);
      toWorld(def, P.u + rtU * BODY.hipHalf * sg, P.v + rtV * BODY.hipHalf * sg, D.pelvis - 0.02, J.hip[sd]);
    }

    for (const sd of ['L', 'R'] as const) {
      const limb: Limb = sd === 'L' ? 'lh' : 'rh';
      const sg = sd === 'L' ? -1 : 1;
      const spot = cur[limb];
      const isReach = a.reach === sd;
      const arc = isReach && t < 1 && !reduced ? Math.sin(Math.PI * limbT[limb]) * 0.16 : 0;
      toWorld(def, spot.u, spot.v, 0.03, J.hold[sd]);
      toWorld(def, spot.u, spot.v + def.handOffsetV, D.hand + arc, J.ha[sd]);
      if (chalkW > 0 && a.chalkHand === sd && rig.chalk) {
        tmp.copy(J.pelvis).addScaledVector(def.normal, 0.16).addScaledVector(def.right, sg * 0.05);
        J.ha[sd].lerp(tmp, chalkW);
      }
      J.pole.copy(J.sh[sd]).addScaledVector(def.up, -0.5).addScaledVector(def.right, sg * 0.6).addScaledVector(def.normal, 0.5);
      solveTwoBone(J.sh[sd], J.ha[sd], BODY.upperArm, BODY.forearm, J.pole, J.el[sd], J.ha[sd]);

      const fl: Limb = sd === 'L' ? 'lf' : 'rf';
      toWorld(def, cur[fl].u, cur[fl].v, D.foot, J.ft[sd]);
      J.pole.copy(J.hip[sd]).addScaledVector(def.right, sg * 0.9).addScaledVector(def.normal, 0.6).addScaledVector(def.up, 0.2);
      solveTwoBone(J.hip[sd], J.ft[sd], BODY.thigh, BODY.shin, J.pole, J.kn[sd], J.ft[sd]);
    }

    // --- Place parts ----------------------------------------------------------------------------
    const puffy = outfit.sleeves === 'puffy';
    const bulk = puffy ? 1.22 : 1;
    // Torso basis: x across the shoulders, y up the spine, z out of the chest.
    const yb = tmp.subVectors(J.chest, J.pelvis).normalize();
    const xb = tmp2.subVectors(J.sh.R, J.sh.L).normalize();
    const zb = new Vector3().crossVectors(xb, yb).normalize();
    xb.crossVectors(yb, zb).normalize();
    basis.makeBasis(xb, yb, zb);
    rig.torso.quaternion.setFromRotationMatrix(basis);
    rig.torso.position.lerpVectors(J.pelvis, J.chest, 0.55);
    const torsoLen = J.pelvis.distanceTo(J.chest);
    rig.torso.scale.set(0.2 * bulk, torsoLen * 0.62, 0.14 * bulk * (1 + breathe * 3));
    rig.hips.quaternion.copy(rig.torso.quaternion);
    rig.hips.position.copy(J.pelvis);
    rig.hips.scale.set(0.18, 0.12, 0.13);

    rig.head.position.copy(J.head);
    if (a.reach) J.look.copy(a.reach === 'L' ? J.ha.L : J.ha.R);
    else J.look.copy(J.chest).addScaledVector(def.up, 0.8);
    J.look.addScaledVector(def.normal, -0.6);
    rig.head.up.copy(def.up);
    rig.head.lookAt(J.look);

    for (const sd of ['L', 'R'] as const) {
      segment(rig.upperArm[sd], J.sh[sd], J.el[sd], 0.062 * bulk);
      const sl = rig.sleeve[sd];
      if (sl) {
        tmp.lerpVectors(J.sh[sd], J.el[sd], 0.45);
        segment(sl, J.sh[sd], tmp, 0.078);
      }
      segment(rig.forearm[sd], J.el[sd], J.ha[sd], 0.052 * (puffy ? 1.2 : 1));
      rig.elbow[sd].position.copy(J.el[sd]);
      rig.elbow[sd].scale.setScalar(0.062 * bulk);
      rig.hand[sd].position.copy(J.ha[sd]);
      rig.hand[sd].scale.setScalar(0.06);
      segment(rig.thigh[sd], J.hip[sd], J.kn[sd], 0.085);
      segment(rig.shin[sd], J.kn[sd], J.ft[sd], 0.07);
      rig.knee[sd].position.copy(J.kn[sd]);
      rig.knee[sd].scale.setScalar(0.08);
      // Shoe: toe into the wall, sole down.
      const f = rig.foot[sd];
      f.position.copy(J.ft[sd]).addScaledVector(def.normal, 0.02);
      basis.makeBasis(def.right, def.up, def.normal);
      f.quaternion.setFromRotationMatrix(basis);
      f.scale.set(0.065, 0.06, 0.13);

      const axe = rig.axes?.[sd];
      if (axe) {
        // Shaft from the hand up to the pick, pick pointing into the wall.
        tmp.subVectors(J.hold[sd], J.ha[sd]);
        const len = tmp.length();
        axe.position.copy(J.ha[sd]).addScaledVector(tmp.normalize(), -0.08);
        const yAx = tmp;
        const zAx = tmp2.copy(def.normal).addScaledVector(yAx, -def.normal.dot(yAx)).normalize();
        const xAx = new Vector3().crossVectors(yAx, zAx);
        basis.makeBasis(xAx, yAx, zAx);
        axe.quaternion.setFromRotationMatrix(basis);
        const snap = a.reach === sd ? Math.max(0, 1 - (now - a.tick) / motion.axeTick) : 0;
        axe.rotateX(-0.35 * snap);
        axe.scale.set(1, len + 0.08, 1);
      }
    }
    if (rig.chalk) {
      rig.chalk.position.copy(J.pelvis).addScaledVector(def.normal, 0.15).addScaledVector(def.up, -0.02);
      rig.chalk.quaternion.copy(rig.torso.quaternion);
    }

    // Ice chips.
    if (rig.chips) {
      const m = rig.chips;
      let n = 0;
      a.chips = a.chips.filter((c) => (c.age += dt) < 0.4);
      for (const c of a.chips) {
        c.v.y -= 6 * dt;
        c.p.addScaledVector(c.v, dt);
        basis.makeRotationY(c.age * 9).setPosition(c.p);
        m.setMatrixAt(n++, basis);
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return <primitive object={rig.root} />;
}

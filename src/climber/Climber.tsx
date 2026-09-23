// The climber (spec §14): a joint rig (pelvis → chest → head, shoulders → elbows → hands,
// hips → knees → feet) driven by authored poses per hold. Limbs are solved with two-bone IK; body
// parts are toon-shaded low-poly pieces placed on the joints every frame.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  Vector2,
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
import { coverDepth, toWorld } from '../scenes/wall/types';
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

// Body parts are smooth-shaded (unlike the faceted scenery) so the ink pass only draws silhouettes
// and creases, not stripes along every facet of a thin limb.
/** Open tapered tube, unit length along +Y (centred), radius 1 at the root end and `tip` at the other. */
const tube = (tip: number) => new CylinderGeometry(tip, 1, 1, 12, 1, true);
const GEO = {
  upperArm: tube(0.86),
  forearm: tube(0.78),
  sleeve: tube(0.92),
  thigh: tube(0.8),
  shin: tube(0.72),
  neck: tube(0.9),
  ball: new SphereGeometry(1, 14, 10),
};

const lathe = (profile: [number, number][], segments = 18) =>
  new LatheGeometry(
    profile.map(([x, y]) => new Vector2(x, y)),
    segments,
  );

/** Torso from the pelvis (y = 0) to the shoulders (y = 1): waist, chest, rounded shoulders. */
const TORSO = lathe([
  [0.01, 0],
  [0.8, 0],
  [0.84, 0.16],
  [0.8, 0.36],
  [0.88, 0.58],
  [1, 0.76],
  [0.96, 0.9],
  [0.72, 0.98],
  [0.3, 1.01],
  [0.01, 1.02],
]);
/** Shorts / trouser top around the pelvis. */
const SHORTS = lathe([
  [0.01, -0.13],
  [0.86, -0.13],
  [1, -0.04],
  [0.98, 0.08],
  [0.9, 0.14],
  [0.01, 0.14],
]);
/** Belt / leg loop ring, lying in the XZ plane. */
const RING = new TorusGeometry(1, 0.12, 6, 22).rotateX(Math.PI / 2);

const Y = new Vector3(0, 1, 0);
const q = new Quaternion();
const segDir = new Vector3();
const tmp = new Vector3();
const tmp2 = new Vector3();
const tmp3 = new Vector3();
const basis = new Matrix4();

/** Stretches a unit Y-tube from a to b with the given root radius. */
function segment(mesh: Object3D, a: Vector3, b: Vector3, r: number) {
  segDir.subVectors(b, a);
  const len = segDir.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  q.setFromUnitVectors(Y, segDir.divideScalar(len || 1));
  mesh.quaternion.copy(q);
  mesh.scale.set(r, len, r);
}

function makeMesh(geo: BufferGeometry, mat: Material, parent: Object3D) {
  const m = new Mesh(geo, mat);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Smooth, non-indexed copy (keeps the smooth normals) so painted parts can be merged. */
function smooth(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute('uv');
  return out;
}

/** Climbing shoe: toe points into the wall (−z), heel out, rubber rand and sole underneath. */
function shoeGeometry(o: Outfit): BufferGeometry {
  const parts = [
    place(paint(smooth(new SphereGeometry(1, 14, 10)), o.shoes), [0, 0.012, -0.028], [0, 0, 0], [0.066, 0.058, 0.118]),
    place(paint(smooth(new SphereGeometry(1, 14, 8)), o.sole), [0, -0.024, -0.03], [0, 0, 0], [0.07, 0.03, 0.126]),
    // Heel tab, in the rand colour, so the shoe reads from behind.
    place(paint(smooth(new SphereGeometry(1, 10, 6)), o.sole), [0, 0.03, 0.07], [0, 0, 0], [0.03, 0.035, 0.02]),
  ];
  if (o.crampons) {
    parts.push(place(box(0.1, 0.012, 0.2, '#b8bfcc'), [0, -0.055, -0.03]));
    for (const [x, z] of [
      [-0.035, -0.1],
      [0.035, -0.1],
      [-0.035, 0.03],
      [0.035, 0.03],
    ] as const) {
      parts.push(place(paint(flat(new ConeGeometry(0.012, 0.04, 4)), '#b8bfcc'), [x, -0.078, z], [Math.PI, 0, 0]));
    }
    parts.push(place(paint(flat(new ConeGeometry(0.012, 0.05, 4)), '#b8bfcc'), [0, -0.03, -0.165], [-Math.PI / 2, 0, 0]));
  }
  return merge(parts);
}

/** Chalk bag clipped to the back of the harness: bag, stiff white rim, chalk and a brush holder. */
function chalkBagGeometry(color: string): BufferGeometry {
  return merge([
    paint(smooth(new CylinderGeometry(0.062, 0.054, 0.12, 14, 1)), color),
    place(paint(smooth(new TorusGeometry(0.058, 0.012, 6, 16)), '#f4f1ea'), [0, 0.062, 0], [Math.PI / 2, 0, 0]),
    place(paint(smooth(new CylinderGeometry(0.05, 0.05, 0.01, 14)), '#ffffff'), [0, 0.058, 0]),
    place(paint(smooth(new CylinderGeometry(0.012, 0.012, 0.09, 6)), '#2b2d42'), [0.058, 0.0, 0.01]),
  ]);
}

interface Rig {
  root: Group;
  torso: Mesh;
  shorts: Mesh;
  belt: Mesh;
  neck: Mesh;
  head: Group;
  shoulder: Record<'L' | 'R', Mesh>;
  upperArm: Record<'L' | 'R', Mesh>;
  sleeve: Record<'L' | 'R', Mesh | null>;
  forearm: Record<'L' | 'R', Mesh>;
  elbow: Record<'L' | 'R', Mesh>;
  hand: Record<'L' | 'R', Mesh>;
  thigh: Record<'L' | 'R', Mesh>;
  legLoop: Record<'L' | 'R', Mesh>;
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
  const harness = toon(o.harness);
  const armMat = o.sleeves === 'long' || puffy ? shirt : skin;
  const handMat = toon(o.gloves ?? o.skin);
  const shinMat = o.legs === 'long' ? pants : skin;

  const torso = makeMesh(TORSO, shirt, root);
  const shorts = makeMesh(SHORTS, pants, root);
  const belt = makeMesh(RING, harness, root);
  const neck = makeMesh(GEO.neck, skin, root);

  // Head (local +z is the face; it looks at where the climber is reaching).
  const head = new Group();
  root.add(head);
  const R = BODY.headR;
  makeMesh(new SphereGeometry(R, 18, 14), skin, head);
  for (const x of [-1, 1]) {
    const ear = makeMesh(GEO.ball, skin, head);
    ear.position.set(x * R * 0.97, -R * 0.08, -R * 0.05);
    ear.scale.set(R * 0.2, R * 0.3, R * 0.24);
  }
  if (o.helmet) {
    const helmet = makeMesh(new SphereGeometry(R * 1.17, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.54), toon(o.helmet), head);
    helmet.position.y = R * 0.08;
    const rim = makeMesh(new TorusGeometry(R * 1.13, R * 0.07, 6, 24).rotateX(Math.PI / 2), toon(o.helmet), head);
    rim.position.y = R * 0.1;
  } else {
    // Hair: cap over the top and back, and a bun with a hair tie.
    const hairMat = toon(o.hair);
    const cap = makeMesh(new SphereGeometry(R * 1.08, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat, head);
    cap.rotation.x = -0.45;
    cap.position.set(0, R * 0.04, -R * 0.03);
    const bun = makeMesh(GEO.ball, hairMat, head);
    bun.position.set(0, R * 0.5, -R * 0.95);
    bun.scale.setScalar(R * 0.42);
    const tie = makeMesh(RING, toon(o.shoes), head);
    tie.position.set(0, R * 0.38, -R * 0.83);
    tie.rotation.x = 0.9;
    tie.scale.setScalar(R * 0.26);
  }
  // Face: only seen when the climber glances back over a shoulder.
  const eyeGeo = new SphereGeometry(R * 0.12, 8, 6);
  const cheekGeo = new SphereGeometry(R * 0.14, 8, 6);
  for (const x of [-0.34, 0.34]) {
    const eye = new Mesh(eyeGeo, toon('#151515'));
    eye.position.set(x * R, R * 0.1, R * 0.92);
    head.add(eye);
    const cheek = new Mesh(cheekGeo, toon('#f59a8a'));
    cheek.position.set(x * R * 1.45, -R * 0.2, R * 0.8);
    cheek.scale.set(1, 0.6, 0.4);
    head.add(cheek);
  }
  const smile = new Mesh(new TorusGeometry(R * 0.26, R * 0.05, 5, 12, Math.PI), toon('#151515'));
  smile.rotation.z = Math.PI;
  smile.position.set(0, -R * 0.2, R * 0.93);
  head.add(smile);

  const side = <T,>(f: (s: 'L' | 'R') => T): Record<'L' | 'R', T> => ({ L: f('L'), R: f('R') });
  const shoulder = side(() => makeMesh(GEO.ball, o.sleeves === 'none' ? skin : shirt, root));
  const upperArm = side(() => makeMesh(GEO.upperArm, armMat, root));
  const sleeve = side(() => (o.sleeves === 'short' ? makeMesh(GEO.sleeve, shirt, root) : null));
  const forearm = side(() => makeMesh(GEO.forearm, puffy ? shirt : skin, root));
  const elbow = side(() => makeMesh(GEO.ball, puffy ? shirt : skin, root));
  const hand = side(() => makeMesh(GEO.ball, handMat, root));
  const thigh = side(() => makeMesh(GEO.thigh, pants, root));
  const legLoop = side(() => makeMesh(RING, harness, root));
  const shin = side(() => makeMesh(GEO.shin, shinMat, root));
  const knee = side(() => makeMesh(GEO.ball, o.legs === 'long' ? pants : skin, root));
  const shoeGeo = shoeGeometry(o);
  const foot = side(() => makeMesh(shoeGeo, toonVC(), root));

  const chalk = o.chalkBag ? makeMesh(chalkBagGeometry(o.chalkBag), toonVC(), root) : null;

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
  }
  // Bits thrown off when a hand lands: ice chips from an axe, a chalk puff everywhere else.
  chips = new InstancedMesh(o.axes ? flat(new TetrahedronGeometry(0.03)) : new SphereGeometry(0.045, 6, 4), toon(o.axes ? '#c8f0ff' : '#ffffff'), 20);
  chips.frustumCulled = false;
  chips.count = 0;
  root.add(chips);
  noInk.add(chips);

  return { root, torso, shorts, belt, neck, head, shoulder, upperArm, sleeve, forearm, elbow, hand, thigh, legLoop, shin, knee, foot, chalk, axes, chips };
}

interface Chip {
  p: Vector3;
  v: Vector3;
  age: number;
  life: number;
}

const chipScale = new Vector3();

/** A small chalk cloud at `at`, blown out from the wall. */
function puff(list: Chip[], at: Vector3, normal: Vector3, n: number) {
  for (let i = 0; i < n; i++) {
    list.push({
      p: at.clone(),
      v: new Vector3()
        .copy(normal)
        .multiplyScalar(0.25 + Math.random() * 0.25)
        .add(new Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.35, (Math.random() - 0.5) * 0.2)),
      age: 0,
      life: 0.55 + Math.random() * 0.25,
    });
  }
}

/** Glance over the shoulder: ease in, hold, ease out (seconds). */
const GLANCE = { delay: 0.2, in: 0.25, hold: 0.9, out: 0.35, turn: (130 * Math.PI) / 180 };

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
    glance: -10,
    puffed: false,
  });

  useEffect(() => () => {
    if (rig.chips) noInk.delete(rig.chips);
  }, [rig]);

  // World-space joint scratch.
  const J = useMemo(
    () => ({
      pelvis: new Vector3(),
      chest: new Vector3(),
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
      bag: new Vector3(),
      xb: new Vector3(),
      yb: new Vector3(),
      zb: new Vector3(),
      torsoQ: new Quaternion(),
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
        a.glance = -10;
        a.chips = [];
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

    // The reaching hand lands: axe "tick" and ice chips on the glacier, a chalk puff elsewhere; a
    // pinned hold also gets a glance back over the shoulder.
    if (!a.landed && t >= 1) {
      a.landed = true;
      if (a.reach && !reduced) {
        const hold = a.reach === 'L' ? a.cur.lh : a.cur.rh;
        const p = toWorld(def, hold.u, hold.v, 0.05 + coverDepth(def, hold.u, hold.v));
        if (rig.axes) {
          a.tick = now;
          for (let i = 0; i < 7; i++) {
            a.chips.push({
              p: p.clone(),
              v: new Vector3().copy(def.normal).multiplyScalar(0.6 + Math.random() * 0.6).add(tmp2.set((Math.random() - 0.5) * 1.2, Math.random() * 0.8, 0)),
              age: 0,
              life: 0.4,
            });
          }
        } else {
          puff(a.chips, p, def.normal, 7);
        }
        if (s.pinnedItem && s.pinnedItem === a.targetId) a.glance = now + GLANCE.delay;
      }
    }

    // Idle: occasional chalk dip with the non-reaching hand (not on the glacier).
    if (rig.chalk && !reduced && t >= 1) {
      if (a.chalk < 0 && now - a.idleSince > motion.chalkIdleDelay && now > a.nextChalk) {
        a.chalk = now;
        a.puffed = false;
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
        // A little cloud as the hand comes out of the bag.
        if (ct > 0.55 && !a.puffed) {
          a.puffed = true;
          puff(a.chips, tmp.copy(J.bag).addScaledVector(J.yb, 0.08), def.normal, 4);
        }
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
    toWorld(def, C.u + upU * (BODY.neck + BODY.headR * 0.95), C.v + upV * (BODY.neck + BODY.headR * 0.95), D.head, J.head);
    for (const sd of ['L', 'R'] as const) {
      const sg = sd === 'L' ? -1 : 1;
      toWorld(def, C.u + rtU * BODY.shoulderHalf * sg, C.v + rtV * BODY.shoulderHalf * sg, D.chest, J.sh[sd]);
      toWorld(def, P.u + rtU * BODY.hipHalf * sg, P.v + rtV * BODY.hipHalf * sg, D.pelvis - 0.02, J.hip[sd]);
    }

    // Torso basis: x across the shoulders, y up the spine, z out of the back (away from the wall).
    const yb = J.yb.subVectors(J.chest, J.pelvis).normalize();
    const xb = J.xb.subVectors(J.sh.R, J.sh.L).normalize();
    const zb = J.zb.crossVectors(xb, yb).normalize();
    xb.crossVectors(yb, zb).normalize();
    basis.makeBasis(xb, yb, zb);
    J.torsoQ.setFromRotationMatrix(basis);
    const torsoLen = J.pelvis.distanceTo(J.chest);
    const puffy = outfit.sleeves === 'puffy';
    const bulk = puffy ? 1.2 : 1;
    // Chalk bag hangs off the back of the harness belt.
    J.bag.copy(J.pelvis).addScaledVector(yb, 0.02).addScaledVector(zb, 0.2);

    for (const sd of ['L', 'R'] as const) {
      const limb: Limb = sd === 'L' ? 'lh' : 'rh';
      const sg = sd === 'L' ? -1 : 1;
      const spot = cur[limb];
      const isReach = a.reach === sd;
      const arc = isReach && t < 1 && !reduced ? Math.sin(Math.PI * limbT[limb]) * 0.16 : 0;
      const cover = coverDepth(def, spot.u, spot.v);
      toWorld(def, spot.u, spot.v, 0.03 + cover, J.hold[sd]);
      toWorld(def, spot.u, spot.v + def.handOffsetV, D.hand + arc + cover, J.ha[sd]);
      if (chalkW > 0 && a.chalkHand === sd && rig.chalk) {
        tmp.copy(J.bag).addScaledVector(yb, 0.08).addScaledVector(xb, sg * 0.03);
        J.ha[sd].lerp(tmp, chalkW);
      }
      J.pole.copy(J.sh[sd]).addScaledVector(def.up, -0.5).addScaledVector(def.right, sg * 0.6).addScaledVector(def.normal, 0.5);
      solveTwoBone(J.sh[sd], J.ha[sd], BODY.upperArm, BODY.forearm, J.pole, J.el[sd], J.ha[sd]);

      const fl: Limb = sd === 'L' ? 'lf' : 'rf';
      toWorld(def, cur[fl].u, cur[fl].v, D.foot + coverDepth(def, cur[fl].u, cur[fl].v), J.ft[sd]);
      J.pole.copy(J.hip[sd]).addScaledVector(def.right, sg * 0.9).addScaledVector(def.normal, 0.6).addScaledVector(def.up, 0.2);
      solveTwoBone(J.hip[sd], J.ft[sd], BODY.thigh, BODY.shin, J.pole, J.kn[sd], J.ft[sd]);
    }

    // --- Place parts ----------------------------------------------------------------------------
    rig.torso.quaternion.copy(J.torsoQ);
    rig.torso.position.copy(J.pelvis).addScaledVector(yb, 0.02);
    rig.torso.scale.set(0.2 * bulk, torsoLen + 0.06, 0.135 * bulk * (1 + breathe * 3));
    rig.shorts.quaternion.copy(J.torsoQ);
    rig.shorts.position.copy(J.pelvis);
    rig.shorts.scale.set(0.175, 1, 0.14);
    rig.belt.quaternion.copy(J.torsoQ);
    rig.belt.position.copy(J.pelvis).addScaledVector(yb, 0.08);
    rig.belt.scale.set(0.183, 0.16, 0.148);

    tmp.copy(J.pelvis).addScaledVector(yb, torsoLen + 0.02);
    segment(rig.neck, tmp, J.head, 0.058);
    rig.head.position.copy(J.head);
    if (a.reach) J.look.copy(a.reach === 'L' ? J.ha.L : J.ha.R);
    else J.look.copy(J.chest).addScaledVector(def.up, 0.8);
    J.look.addScaledVector(def.normal, -0.6);
    // Glance: turn the head about the wall's up axis toward the camera's side, into profile.
    const g = now - a.glance;
    const glanceW =
      reduced || g < 0
        ? 0
        : g < GLANCE.in
          ? easeInOutCubic(g / GLANCE.in)
          : g < GLANCE.in + GLANCE.hold
            ? 1
            : 1 - easeInOutCubic(clamp01((g - GLANCE.in - GLANCE.hold) / GLANCE.out));
    if (glanceW > 0) {
      const sideSign = Math.sign(tmp.subVectors(state.camera.position, J.head).dot(def.right)) || 1;
      tmp2.subVectors(J.look, J.head).applyAxisAngle(def.up, sideSign * GLANCE.turn * glanceW);
      J.look.copy(J.head).add(tmp2);
    }
    rig.head.up.copy(def.up);
    rig.head.lookAt(J.look);

    for (const sd of ['L', 'R'] as const) {
      rig.shoulder[sd].position.copy(J.sh[sd]);
      rig.shoulder[sd].scale.setScalar(0.078 * bulk);
      segment(rig.upperArm[sd], J.sh[sd], J.el[sd], 0.07 * bulk);
      const sl = rig.sleeve[sd];
      if (sl) {
        tmp3.lerpVectors(J.sh[sd], J.el[sd], 0.42);
        segment(sl, J.sh[sd], tmp3, 0.086);
      }
      segment(rig.forearm[sd], J.el[sd], J.ha[sd], 0.064 * (puffy ? 1.18 : 1));
      rig.elbow[sd].position.copy(J.el[sd]);
      rig.elbow[sd].scale.setScalar(0.061 * bulk);
      rig.hand[sd].position.copy(J.ha[sd]);
      rig.hand[sd].scale.setScalar(0.064);
      segment(rig.thigh[sd], J.hip[sd], J.kn[sd], 0.098);
      tmp3.lerpVectors(J.hip[sd], J.kn[sd], 0.2);
      rig.legLoop[sd].position.copy(tmp3);
      segDir.subVectors(J.kn[sd], J.hip[sd]).normalize();
      rig.legLoop[sd].quaternion.setFromUnitVectors(Y, segDir);
      rig.legLoop[sd].scale.set(0.1, 0.14, 0.1);
      segment(rig.shin[sd], J.kn[sd], J.ft[sd], 0.078);
      rig.knee[sd].position.copy(J.kn[sd]);
      rig.knee[sd].scale.setScalar(outfit.legs === 'long' ? 0.08 : 0.072);
      // Shoe: toe into the wall, sole down, sitting just under the ankle.
      const f = rig.foot[sd];
      f.position.copy(J.ft[sd]).addScaledVector(def.normal, 0.03).addScaledVector(def.up, -0.02);
      basis.makeBasis(def.right, def.up, def.normal);
      f.quaternion.setFromRotationMatrix(basis);

      const axe = rig.axes?.[sd];
      if (axe) {
        // Shaft from the hand up to the pick, pick pointing into the wall.
        tmp.subVectors(J.hold[sd], J.ha[sd]);
        const len = tmp.length();
        axe.position.copy(J.ha[sd]).addScaledVector(tmp.normalize(), -0.08);
        const yAx = tmp;
        const zAx = tmp2.copy(def.normal).addScaledVector(yAx, -def.normal.dot(yAx)).normalize();
        const xAx = tmp3.crossVectors(yAx, zAx);
        basis.makeBasis(xAx, yAx, zAx);
        axe.quaternion.setFromRotationMatrix(basis);
        const snap = a.reach === sd ? Math.max(0, 1 - (now - a.tick) / motion.axeTick) : 0;
        axe.rotateX(-0.35 * snap);
        axe.scale.set(1, len + 0.08, 1);
      }
    }
    if (rig.chalk) {
      rig.chalk.position.copy(J.bag);
      rig.chalk.quaternion.copy(J.torsoQ);
    }

    // Ice chips fall; chalk drifts, swells and fades.
    if (rig.chips) {
      const m = rig.chips;
      let n = 0;
      a.chips = a.chips.filter((c) => (c.age += dt) < c.life).slice(-m.instanceMatrix.count);
      for (const c of a.chips) {
        let size = 1;
        if (rig.axes) c.v.y -= 6 * dt;
        else {
          const k = c.age / c.life;
          c.v.multiplyScalar(Math.max(0, 1 - 3 * dt));
          c.v.y += 0.4 * dt;
          size = (0.7 + 1.6 * k) * (1 - k * k);
        }
        c.p.addScaledVector(c.v, dt);
        basis.makeRotationY(c.age * 9).scale(chipScale.setScalar(size)).setPosition(c.p);
        m.setMatrixAt(n++, basis);
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return <primitive object={rig.root} />;
}

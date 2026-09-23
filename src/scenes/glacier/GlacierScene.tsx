// Experience: glacier ice face (spec §7.2).
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  Fog,
  IcosahedronGeometry,
  PlaneGeometry,
  Points,
  PointsMaterial,
  TetrahedronGeometry,
  Vector3,
} from 'three';
import type { SectionSceneProps } from '../../app/SectionHost';
import { Climber } from '../../climber/Climber';
import { OUTFITS } from '../../climber/outfits';
import { fbm } from '../../lib/noise';
import { pick, rng, range, type Rng } from '../../lib/rng';
import { box, flat, jitter, merge, paint, paintFaces, place } from '../../render/geo';
import { SkyDome } from '../../render/sky';
import { shadowMap } from '../../render/shadows';
import { toonVC } from '../../render/toon';
import { noInk } from '../../state/registry';
import { getState } from '../../state/store';
import { registerAtmosphere } from '../atmosphere';
import { Particles } from '../common/ambient';
import { wallLayout } from '../layouts';
import { pickKind, sculptHold } from '../wall/holdShapes';
import { Holds, type HoldStyle } from '../wall/Holds';
import { cliffFace, edgeRoll, reliefMesh } from '../wall/surface';
import { toWorld } from '../wall/types';
import { glacierWall } from '../walls';

const ICE = ['#7fd3f7', '#a8e4fa', '#6ac4ef', '#94dcf8'];

/** Ice bulges with a snow cap; the axe placements get a chipped pick mark. */
const style: HoldStyle = {
  interactive: (r) =>
    merge([
      sculptHold(r, { kind: pickKind(r, { blob: 1, mushroom: 1, sloper: 1 }), size: 0.26, color: '#c8f2ff', top: '#ffffff', topAmount: 0.45, rough: 0.2 }),
      // Chipped mark where the pick lands.
      place(paint(flat(new TetrahedronGeometry(0.035)), '#5aa8e0'), [0, 0.02, 0.07], [0.6, 0.3, 0]),
    ]),
  support: (r) => sculptHold(r, { kind: pickKind(r, { blob: 1, mushroom: 1 }), size: range(r, 0.15, 0.2), color: '#b4ebfd', top: '#ffffff', topAmount: 0.4, rough: 0.2 }),
  decor: (r) => sculptHold(r, { kind: pickKind(r, { blob: 2, mushroom: 1, sloper: 1 }), size: range(r, 0.12, 0.26), color: pick(r, ICE), top: '#ffffff', topAmount: 0.3, rough: 0.22 }),
  decorCount: 12,
  decorArea: { u0: -2.8, u1: 2.8, v0: 0.5, v1: 4.9 },
};

function jaggedPeak(r: Rng, radius: number, height: number, snowFrom: number): BufferGeometry {
  const g = new ConeGeometry(radius, height, 8, 4);
  jitter(g, radius * 0.1, r);
  return paintFaces(flat(g), (c, n) => (c.y > height * (snowFrom - 0.5) || n.y > 0.75 ? '#f4f8ff' : c.y > 0 ? '#6b7089' : '#7c8199'));
}

/** Tall rock rib with snow on every ledge, base at y = 0. */
function buttress(r: Rng, at: [number, number, number], w: number, h: number, d: number, lean: number): BufferGeometry {
  const g = new IcosahedronGeometry(1, 2);
  jitter(g, 0.13, r);
  const m = place(flat(g), [0, h * 0.45, 0], [0, 0, 0], [w, h * 0.55, d]);
  // Lean the top over a little and taper it.
  const p = m.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = Math.max(0, y) / h;
    p.setX(i, p.getX(i) * (1 - 0.35 * k) + lean * k * 2);
  }
  m.computeVertexNormals();
  const tones = ['#6b7089', '#7c8199', '#5f6480'];
  return place(
    paintFaces(m, (c, n) => (n.y > 0.45 ? '#f4f8ff' : tones[Math.abs(Math.floor(c.y * 1.3 + fbm(c.x, c.z, 35) * 2)) % 3]!)),
    at,
  );
}

/** Valley floor level, far below the start ledge. */
const VALLEY_Y = -70;
/** The ice face's right-hand end (u), past which the view opens up. */
const FACE_END = 4.4;

/** Ground height of the valley, with the glacier's trough. */
function valleyY(x: number, z: number) {
  return VALLEY_Y + 10 * fbm(x * 0.006, z * 0.006, 61) + 0.05 * Math.abs(x - glacierX(z));
}

/** Centre line of the glacier as it winds down the valley toward the viewer. */
const glacierX = (z: number) => 45 + (z + 80) * 0.28 + 20 * Math.sin(z * 0.012);

function rockOrSnow(y: number, n: Vector3, c: Vector3) {
  if (n.y > 0.5) return '#f4f8ff';
  return fbm(c.x * 0.2 + c.z * 0.2, y * 0.2, 35) > 0.1 ? '#5f6480' : '#6b7089';
}

function buildScene() {
  const def = glacierWall;
  const r = rng(515);
  const up = new Vector3(0, 1, 0);
  const parts: BufferGeometry[] = [];

  // The ice face: a frozen flow down the mountain, rising far above the route. Rock shows through
  // toward its sides; snow sits on every ledge.
  parts.push(
    reliefMesh(def, {
      u0: -14,
      u1: FACE_END + 0.2,
      v0: -0.3,
      vTop: (u) => 15 + 0.8 * Math.sin(u * 0.7) + 0.6 * fbm(u * 1.2, 3, 12),
      nu: 96,
      nv: 84,
      roll: edgeRoll({ right: [FACE_END - 1.2, FACE_END + 0.2, 2.0] }),
      color: (u, v, n) => {
        if (n.dot(up) > 0.55) return '#f4f8ff';
        const edge = Math.max(-4.2 - u, u - (FACE_END - 0.7));
        if (edge > 0 && fbm(u * 0.45 + 5, v * 0.45, 31) > 0.35 - edge * 0.5) return fbm(u, v, 32) > 0 ? '#7c8199' : '#8a8fa8';
        const band = fbm(u * 1.3, v * 0.14, 33) + 0.25 * fbm(u * 3, v * 3, 34);
        return ICE[Math.floor((band + 1) * 2.5) % ICE.length]!;
      },
    }),
  );

  // The mountain ends in a rock prow past the ice, running away back-left; its side faces away
  // from the camera, so the right of the frame is open valley.
  parts.push(cliffFace([FACE_END - 0.2, -1.8], [-22, -50], VALLEY_Y, 15, { segs: 40, rows: 40, rough: 1.2, seed: 71, color: rockOrSnow }));
  // Left buttresses (off to the side of the route).
  parts.push(buttress(r, [-5.5, 0, -0.1], 2.3, 7.8, 2.4, 0.25));
  parts.push(buttress(r, [-7.8, 0, -1.6], 2.2, 9.5, 2.4, 0.6));

  // The start ledge: a snow shelf, drifts deeper toward the rock, then the drop below.
  const shelf = new PlaneGeometry(20, 2.6, 36, 5);
  shelf.rotateX(-Math.PI / 2);
  const sp = shelf.getAttribute('position');
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i) + (FACE_END - 9.8);
    const z = sp.getZ(i) + 1.2;
    sp.setXYZ(i, x, 0.05 * fbm(x * 1.5, z * 1.5, 62) - Math.max(0, z - 2.0) * 0.4, z);
  }
  parts.push(paintFaces(flat(shelf), (c) => (fbm(c.x * 0.5, c.z * 0.5, 62) > 0.2 ? '#e6eefb' : '#f7faff')));
  for (const [x, z, w, h] of [
    [0, 0.3, 3.2, 0.14],
    [-2.9, 0.45, 1.8, 0.32],
    [2.8, 0.5, 1.7, 0.3],
    [-4.4, 0.7, 1.6, 0.55],
  ] as const) {
    const g = new IcosahedronGeometry(1, 2);
    jitter(g, 0.05, r);
    parts.push(place(paintFaces(flat(g), (_c, n) => (n.y > 0.4 ? '#f7faff' : '#e1eafa')), [x, 0, z], [0, 0, 0], [w, h, 0.75]));
  }
  parts.push(cliffFace([-14, 2.45], [FACE_END + 0.4, 2.45], VALLEY_Y, 0.02, { segs: 50, rows: 40, rough: 1.0, seed: 72, color: rockOrSnow }));
  parts.push(cliffFace([FACE_END + 0.4, 2.45], [FACE_END - 0.2, -1.8], VALLEY_Y, 0.02, { segs: 8, rows: 40, rough: 0.6, seed: 73, color: rockOrSnow }));

  // Valley floor, the glacier winding down it, its crevasses and moraines.
  const floor = new PlaneGeometry(900, 900, 60, 60);
  floor.rotateX(-Math.PI / 2);
  const fp = floor.getAttribute('position');
  for (let i = 0; i < fp.count; i++) fp.setY(i, valleyY(fp.getX(i), fp.getZ(i)));
  parts.push(paintFaces(flat(floor), (c) => (fbm(c.x * 0.02, c.z * 0.02, 64) > 0.15 ? '#dfe7f5' : '#c9d3e6')));
  const ribbon = (offset: number, width: number, color: string, lift: number) => {
    const pos: number[] = [];
    for (let z = -40; z > -560; z -= 12) {
      const z2 = z - 12;
      const x1 = glacierX(z) + offset;
      const x2 = glacierX(z2) + offset;
      const y1 = valleyY(x1, z) + lift;
      const y2 = valleyY(x2, z2) + lift;
      pos.push(x1 - width, y1, z, x1 + width, y1, z, x2 + width, y2, z2, x1 - width, y1, z, x2 + width, y2, z2, x2 - width, y2, z2);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.computeVertexNormals();
    return paint(g, color);
  };
  parts.push(ribbon(0, 26, '#a8dcf5', 0.6));
  parts.push(ribbon(-27, 3, '#6b6f82', 0.7));
  parts.push(ribbon(27, 3, '#6b6f82', 0.7));
  parts.push(ribbon(6, 1.2, '#7c8199', 0.8));
  for (let k = 0; k < 40; k++) {
    const z = range(r, -460, -50);
    const x = glacierX(z) + range(r, -18, 18);
    parts.push(place(box(range(r, 6, 12), 0.2, 0.9, '#5aa8e0'), [x, valleyY(x, z) + 0.9, z], [0, range(r, -0.3, 0.3), 0]));
  }

  // Ranges either side of the valley, and a far wall of peaks, fading into the haze.
  for (let i = 0; i < 12; i++) {
    const z = range(r, -540, -230);
    const h = range(r, 70, 150);
    parts.push(place(jaggedPeak(r, h * range(r, 0.4, 0.55), h, 0.55), [glacierX(z) - range(r, 55, 115), VALLEY_Y + h / 2 - 5, z]));
  }
  for (let i = 0; i < 12; i++) {
    const z = range(r, -540, -270);
    const h = range(r, 70, 150);
    parts.push(place(jaggedPeak(r, h * range(r, 0.4, 0.55), h, 0.55), [glacierX(z) + range(r, 55, 120), VALLEY_Y + h / 2 - 5, z]));
  }
  for (let i = 0; i < 9; i++) {
    const h = range(r, 140, 230);
    parts.push(place(jaggedPeak(r, h * 0.5, h, 0.5), [range(r, -200, 300), VALLEY_Y + h / 2 - 10, range(r, -620, -540)]));
  }
  return merge(parts);
}

/** Occasional wisp of spindrift blown off the top of the left buttress (spec §7.2). */
function Spindrift() {
  const N = 40;
  const { points, vel } = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3));
    const p = new Points(g, new PointsMaterial({ color: '#ffffff', size: 0.07, transparent: true, opacity: 0, depthWrite: false }));
    p.frustumCulled = false;
    return { points: p, vel: Array.from({ length: N }, () => new Vector3()) };
  }, []);
  const state = useRef({ next: 4, start: -10 });
  useEffect(() => {
    noInk.add(points);
    return () => void noInk.delete(points);
  }, [points]);
  useFrame((st, dt) => {
    const s = getState();
    if (s.shown !== 'experience' || s.env.reduced) {
      (points.material as PointsMaterial).opacity = 0;
      return;
    }
    const t = st.clock.elapsedTime;
    const pos = points.geometry.getAttribute('position') as BufferAttribute;
    if (t > state.current.next) {
      state.current.start = t;
      state.current.next = t + 6 + Math.random() * 4;
      const origin = toWorld(glacierWall, -2.9, 5.7, 0.2);
      for (let i = 0; i < N; i++) {
        pos.setXYZ(i, origin.x + Math.random() * 0.8, origin.y + Math.random() * 0.2, origin.z + Math.random() * 0.3);
        vel[i]!.set(0.8 + Math.random() * 1.2, -0.2 - Math.random() * 0.4, 0.3 + Math.random() * 0.4);
      }
    }
    const age = t - state.current.start;
    (points.material as PointsMaterial).opacity = age < 2.5 ? 0.7 * (1 - age / 2.5) : 0;
    if (age < 2.5) {
      for (let i = 0; i < N; i++) pos.setXYZ(i, pos.getX(i) + vel[i]!.x * dt, pos.getY(i) + vel[i]!.y * dt, pos.getZ(i) + vel[i]!.z * dt);
      pos.needsUpdate = true;
    }
  });
  return <primitive object={points} />;
}

const SNOW_BOX = { x: [-7, 7] as [number, number], y: [-0.5, 9] as [number, number], z: [-0.5, 7] as [number, number] };

export default function GlacierScene({ onReady }: SectionSceneProps) {
  const layout = wallLayout('experience');
  const world = useMemo(buildScene, []);
  useEffect(() => {
    const off = registerAtmosphere('experience', { fog: new Fog('#e6e0ff', 70, 680), background: '#e6e0ff' });
    onReady();
    return off;
  }, [onReady]);

  return (
    <group>
      <hemisphereLight args={['#c9d8ff', '#8a7fb0', 1.25]} />
      <directionalLight
        position={[9, 8, 7]}
        intensity={2.5}
        color="#fff1e0"
        castShadow
        shadow-mapSize={shadowMap(1536)}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={8}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.001}
        shadow-normalBias={0.04}
      />
      <SkyDome top="#7d95e0" horizon="#e6e0ff" bottom="#d8d0f5" radius={680} />
      <mesh geometry={world} material={toonVC()} receiveShadow castShadow />
      <Particles section="experience" count={260} box={SNOW_BOX} size={0.07} color="#ffffff" opacity={0.85} fall={0.5} drift={0.12} seed={17} />
      <Spindrift />
      <Holds layout={layout} style={style} />
      <Climber layout={layout} outfit={OUTFITS.glacier} />
    </group>
  );
}

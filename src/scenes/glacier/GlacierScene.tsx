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
import { smoothstep } from '../../lib/ease';
import { fbm } from '../../lib/noise';
import { rng, range, type Rng } from '../../lib/rng';
import { flat, jitter, merge, paint, paintFaces, place } from '../../render/geo';
import { SkyDome } from '../../render/sky';
import { toonVC } from '../../render/toon';
import { noInk } from '../../state/registry';
import { getState } from '../../state/store';
import { registerAtmosphere } from '../atmosphere';
import { Particles } from '../common/ambient';
import { wallLayout } from '../layouts';
import { inWall } from '../wall/helpers';
import { Holds, type HoldStyle } from '../wall/Holds';
import { irregularRoll, reliefMesh } from '../wall/surface';
import { toWorld } from '../wall/types';
import { glacierWall } from '../walls';

const ICE = ['#7fd3f7', '#a8e4fa', '#6ac4ef', '#94dcf8'];

function iceBump(r: Rng, size: number, color: string): BufferGeometry {
  const g = new IcosahedronGeometry(size, 1);
  jitter(g, size * 0.15, r);
  return place(paint(flat(g), color), [0, 0, size * 0.3], [0, 0, 0], [1.3, 0.8, 0.65]);
}

const style: HoldStyle = {
  interactive: (r) =>
    merge([
      iceBump(r, 0.14, '#c8f2ff'),
      // Chipped mark where the pick lands.
      place(paint(flat(new TetrahedronGeometry(0.04)), '#3e8fd6'), [0, 0.02, 0.12], [0.6, 0.3, 0]),
    ]),
  support: (r) => place(iceBump(r, 0.09, '#b4ebfd'), [0, 0, 0], [0, 0, 0], [1.2, 0.6, 1]),
  decor: (r) =>
    r() < 0.45
      ? place(paint(flat(new ConeGeometry(0.07, 0.2, 5)), '#5a5f7a'), [0, 0, 0.08], [Math.PI / 2, 0, 0])
      : iceBump(r, range(r, 0.06, 0.1), '#a8e4fa'),
  decorCount: 16,
  decorArea: { u0: -2.8, u1: 2.8, v0: 0.5, v1: 4.9 },
};

function jaggedPeak(r: Rng, radius: number, height: number, snowFrom: number): BufferGeometry {
  const g = new ConeGeometry(radius, height, 8, 4);
  jitter(g, radius * 0.1, r);
  return paintFaces(flat(g), (c, n) => (c.y > height * (snowFrom - 0.5) || n.y > 0.75 ? '#f4f8ff' : c.y > 0 ? '#6b7089' : '#7c8199'));
}

function buildScene() {
  const def = glacierWall;
  const r = rng(515);
  const up = new Vector3(0, 1, 0);
  const face = reliefMesh(def, {
    u0: -5.4,
    u1: 5.4,
    v0: -0.3,
    vTop: (u) => 7.3 + 0.9 * Math.sin(u * 0.9 + 1) + 0.6 * fbm(u * 1.5, 3, 12) - 3.2 * Math.pow(Math.abs(u) / 5.4, 2),
    nu: 56,
    nv: 46,
    roll: irregularRoll({ half: 5.4, band: 1.9, depth: 2.6, amp: 0.9, seed: 13, top: [1.2, 1.4] }),
    color: (u, v, n) => {
      if (n.dot(up) > 0.55) return '#f4f8ff';
      if (fbm(u * 0.45 + 5, v * 0.45, 31) > 0.46) return fbm(u, v, 32) > 0 ? '#5a5f7a' : '#6b7089';
      const band = fbm(u * 1.3, v * 0.14, 33) + 0.25 * fbm(u * 3, v * 3, 34);
      return ICE[Math.floor((band + 1) * 2.5) % ICE.length]!;
    },
  });
  const parts: BufferGeometry[] = [face];

  // Snow-loaded ledges and icicle curtains beneath them (wall space).
  const ledges: [number, number, number][] = [
    [-1.9, 3.05, 1.6],
    [1.7, 4.75, 1.7],
    [-2.9, 5.6, 1.2],
  ];
  for (const [u, v, w] of ledges) {
    const d = def.surface(u, v);
    const g = new IcosahedronGeometry(1, 1);
    jitter(g, 0.08, r);
    parts.push(inWall(def, place(paint(flat(g), '#f4f8ff'), [u, v, d + 0.05], [0, 0, 0], [w / 2, 0.1, 0.2])));
    for (let k = 0; k < 7; k++) {
      const iu = u + range(r, -w / 2.4, w / 2.4);
      const len = range(r, 0.15, 0.4);
      parts.push(inWall(def, place(paint(flat(new ConeGeometry(0.035, len, 4)), '#bfefff'), [iu, v - 0.08 - len / 2, def.surface(iu, v) + 0.06], [Math.PI, 0, 0])));
    }
  }

  // Mountain mass behind the face, set back so its snowy summit shows above.
  parts.push(place(jaggedPeak(r, 7, 16, 0.5), [1.5, 5, -9]));

  // Snow slope at the base, dropping away at the sides and front.
  const snowG = new PlaneGeometry(40, 30, 40, 30);
  snowG.rotateX(-Math.PI / 2);
  const sp = snowG.getAttribute('position');
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i);
    const z = sp.getZ(i) + 6;
    sp.setZ(i, z);
    const drop = smoothstep(5, 11, Math.abs(x)) * 16 + smoothstep(9, 14, z) * 16;
    sp.setY(i, -0.05 + fbm(x * 0.4, z * 0.4, 61) * 0.18 - drop - Math.max(0, z) * 0.06);
  }
  parts.push(paintFaces(flat(snowG), (c) => (fbm(c.x * 0.5, c.z * 0.5, 62) > 0.2 ? '#e6eefb' : '#f7faff')));

  // Distant peaks, fogged lavender.
  for (let i = 0; i < 16; i++) {
    const a = range(r, -Math.PI * 0.95, -Math.PI * 0.05);
    const dist = range(r, 45, 130);
    const h = range(r, 18, 46);
    parts.push(place(jaggedPeak(r, h * range(r, 0.45, 0.65), h, 0.55), [Math.cos(a) * dist, -22 + h / 2, Math.sin(a) * dist]));
  }
  for (let i = 0; i < 6; i++) {
    const x = (i % 2 ? 1 : -1) * range(r, 22, 45);
    const h = range(r, 14, 26);
    parts.push(place(jaggedPeak(r, h * 0.55, h, 0.5), [x, -30 + h / 2, range(r, -10, 25)]));
  }
  // Glacier tongue far below.
  const tongue = new PlaneGeometry(420, 420, 24, 24);
  tongue.rotateX(-Math.PI / 2);
  jitter(tongue, 0.6, r);
  parts.push(place(paintFaces(flat(tongue), (c) => (fbm(c.x * 0.03, c.z * 0.03, 71) > 0.1 ? '#dfe9f7' : '#b9d4ef')), [0, -38, 0]));
  return merge(parts);
}

/** Occasional wisp of spindrift blown off the top-left ledge (spec §7.2). */
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
    const off = registerAtmosphere('experience', { fog: new Fog('#e6e0ff', 25, 150), background: '#e6e0ff' });
    onReady();
    return off;
  }, [onReady]);

  return (
    <group>
      <hemisphereLight args={['#c9d8ff', '#8a7fb0', 1.25]} />
      <directionalLight
        position={[-9, 6, 7]}
        intensity={2.5}
        color="#fff1e0"
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={8}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.001}
      />
      <SkyDome top="#7d95e0" horizon="#e6e0ff" bottom="#d8d0f5" />
      <mesh geometry={world} material={toonVC()} receiveShadow castShadow />
      <Particles section="experience" count={260} box={SNOW_BOX} size={0.07} color="#ffffff" opacity={0.85} fall={0.5} drift={0.12} seed={17} />
      <Spindrift />
      <Holds layout={layout} style={style} />
      <Climber layout={layout} outfit={OUTFITS.glacier} />
    </group>
  );
}

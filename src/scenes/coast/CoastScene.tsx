// About & Contact: sea cliff above the ocean at golden hour (spec §7.4).
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Fog,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';
import type { SectionSceneProps } from '../../app/SectionHost';
import { Climber } from '../../climber/Climber';
import { OUTFITS } from '../../climber/outfits';
import { fbm } from '../../lib/noise';
import { pick, rng, range, type Rng } from '../../lib/rng';
import { flat, jitter, merge, paint, paintFaces, place, rock } from '../../render/geo';
import { SkyDome } from '../../render/sky';
import { toonVC } from '../../render/toon';
import { noInk } from '../../state/registry';
import { getState } from '../../state/store';
import { registerAtmosphere } from '../atmosphere';
import { Particles } from '../common/ambient';
import { wallLayout } from '../layouts';
import { pickKind, sculptHold } from '../wall/holdShapes';
import { Holds, type HoldStyle } from '../wall/Holds';
import { edgeRoll, reliefMesh } from '../wall/surface';
import { coastWall } from '../walls';

const SEA_Y = -2.5;
const ROCK = ['#b8735a', '#a8664f', '#c98a6a', '#9e6049'];

function ledge(r: Rng, w: number, color: string): BufferGeometry {
  const g = new IcosahedronGeometry(1, 0);
  jitter(g, 0.18, r);
  return place(paint(flat(g), color), [0, 0, w * 0.18], [0, 0, 0], [w, w * 0.22, w * 0.38]);
}

const CHALK = '#fff6ea';

/** Sea-cliff edges and flakes in the rock colour, chalked where hands go. */
const style: HoldStyle = {
  interactive: (r) => sculptHold(r, { kind: pickKind(r, { edge: 2, jug: 1 }), size: 0.24, color: '#dfa47c', top: CHALK, topAmount: 0.55, rough: 0.14 }),
  support: (r) => sculptHold(r, { kind: pickKind(r, { edge: 2, crimp: 1 }), size: range(r, 0.15, 0.19), color: '#cf916b', top: CHALK, topAmount: 0.4, rough: 0.14 }),
  decor: (r) => sculptHold(r, { kind: pickKind(r, { edge: 3, sloper: 1 }), size: range(r, 0.12, 0.22), color: pick(r, ROCK), top: CHALK, topAmount: 0.06, rough: 0.16 }),
  decorCount: 14,
  decorArea: { u0: -2.7, u1: 2.7, v0: 0.4, v1: 4.2 },
};

function buildScene() {
  const def = coastWall;
  const r = rng(707);
  const face = reliefMesh(def, {
    u0: -10,
    u1: 3.9,
    v0: SEA_Y - 0.6,
    vTop: (u) => 6.6 + 0.5 * Math.sin(u * 0.8) + 0.3 * fbm(u, 2, 5),
    nu: 70,
    nv: 48,
    roll: edgeRoll({ right: [2.8, 3.9, 2.8], top: [1.0, 1.3] }),
    color: (u, v, n) => {
      if (n.y > 0.62 && v > 5.4) return fbm(u * 2, v, 8) > 0 ? '#8cc956' : '#7dbb4a';
      if (v < 0.25) return v < -1.8 ? '#4a302a' : '#5e3e36';
      const depth = def.surface(u, v);
      if (depth < -0.08) return '#5e3e36';
      if (n.y > 0.45) return '#e0ac86';
      const band = Math.floor((v + 0.15 * fbm(u, v, 3)) / 0.82);
      return ROCK[((band % ROCK.length) + ROCK.length) % ROCK.length]!;
    },
  });
  const parts: BufferGeometry[] = [face];

  // Start ledge above the water.
  const ledgeG = new IcosahedronGeometry(1, 1);
  jitter(ledgeG, 0.06, r);
  parts.push(place(paintFaces(flat(ledgeG), (_c, n) => (n.y > 0.5 ? '#c98a6a' : '#6e4a3e')), [0.1, -0.35, 0.55], [0, 0, 0], [1.9, 0.38, 0.75]));
  parts.push(place(rock(r, 0.8, '#6e4a3e', 1, 0.2), [0.2, -1.6, 0.4], [0, 0, 0], [1.6, 1.3, 0.8]));

  // Headland mass behind the face, and the cliff line receding to the left.
  const back = new IcosahedronGeometry(1, 2);
  jitter(back, 0.07, r);
  parts.push(place(paintFaces(flat(back), (c, n) => (n.y > 0.6 ? '#8cc956' : ROCK[Math.abs(Math.floor(c.y * 3)) % 4]!)), [-4, 2, -5], [0, 0, 0], [8.5, 5.2, 5]));

  // Sea stack and distant cliffs (fogged).
  const stack = (x: number, z: number, h: number, rad: number) => {
    const g = new CylinderGeometry(rad * 0.75, rad, h, 8, 3);
    jitter(g, rad * 0.1, r);
    return place(paintFaces(flat(g), (c, n) => (n.y > 0.7 ? '#8cc956' : c.y > 0 ? '#b8735a' : '#8c5a4a')), [x, SEA_Y + h / 2 - 1, z]);
  };
  parts.push(stack(13, -24, 14, 2.4));
  parts.push(stack(22, -46, 10, 1.8));
  for (let i = 0; i < 7; i++) {
    const x = range(r, -110, -30);
    const z = range(r, -150, -50);
    const h = range(r, 14, 30);
    const g = new IcosahedronGeometry(1, 1);
    jitter(g, 0.1, r);
    parts.push(place(paintFaces(flat(g), (_c, n) => (n.y > 0.6 ? '#8cc956' : '#a8664f')), [x, SEA_Y + h * 0.3, z], [0, r() * 3, 0], [h * 1.2, h, h * 0.9]));
  }
  return merge(parts);
}

/** Near ocean: a low-poly grid with rolling waves, updated on the CPU so normals stay right. */
function buildOcean() {
  const W = 90;
  const D = 70;
  const nx = 60;
  const nz = 46;
  const base: [number, number][] = [];
  const pos: number[] = [];
  const grid = (i: number, j: number): [number, number] => [-30 + (W * i) / nx, -60 + (D * j) / nz];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = grid(i, j);
      const b = grid(i + 1, j);
      const c = grid(i + 1, j + 1);
      const d = grid(i, j + 1);
      for (const p of [a, d, c, a, c, b]) {
        base.push(p);
        pos.push(p[0], SEA_Y, p[1]);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(pos.length), 3));
  g.computeVertexNormals();
  return { geometry: g, base };
}

const deep = new Color('#1f6fb2');
const mid = new Color('#2f9bd6');
const crest = new Color('#6cc8ee');
const foam = new Color('#ffffff');
const tmpC = new Color();

function waveY(x: number, z: number, t: number) {
  return 0.13 * Math.sin(x * 0.55 + t * 1.1) + 0.09 * Math.sin(z * 0.8 - t * 0.9 + x * 0.2) + 0.05 * Math.sin((x + z) * 1.3 + t * 1.7);
}

export default function CoastScene({ onReady }: SectionSceneProps) {
  const layout = wallLayout('about');
  const world = useMemo(buildScene, []);
  const ocean = useMemo(buildOcean, []);
  const far = useMemo(() => {
    const p = new PlaneGeometry(900, 900);
    p.rotateX(-Math.PI / 2);
    return new Mesh(p, new MeshBasicMaterial({ color: '#2f86c4' }));
  }, []);
  const sun = useMemo(() => {
    const m = new Mesh(new CircleGeometry(16, 24), new MeshBasicMaterial({ color: '#fff1c9', fog: false }));
    m.position.set(120, 8, -280);
    m.lookAt(0, 3, 0);
    noInk.add(m);
    return m;
  }, []);

  const animate = (t: number) => {
    const pos = ocean.geometry.getAttribute('position') as BufferAttribute;
    const col = ocean.geometry.getAttribute('color') as BufferAttribute;
    for (let i = 0; i < ocean.base.length; i++) {
      const [x, z] = ocean.base[i]!;
      const y = waveY(x, z, t);
      pos.setY(i, SEA_Y + y);
      const nearCliff = z < 1.6 && z > -1.5 && x < 4.2 ? 1 - (z + 1.5) / 3.1 : 0;
      const k = (y + 0.25) / 0.5;
      tmpC.copy(deep).lerp(mid, Math.min(1, Math.max(0, k * 1.3)));
      if (k > 0.82) tmpC.copy(crest);
      if (nearCliff > 0.35 && Math.sin(x * 3 + t * 2) > -0.2) tmpC.copy(foam);
      col.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    ocean.geometry.computeVertexNormals();
  };

  useEffect(() => {
    animate(0);
    const off = registerAtmosphere('about', { fog: new Fog('#ffc9a0', 30, 170), background: '#ffc9a0' });
    onReady();
    return () => {
      off();
      noInk.delete(sun);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReady, sun]);

  useFrame((state) => {
    const s = getState();
    if (s.shown !== 'about' || s.env.reduced) return;
    animate(state.clock.elapsedTime);
  });

  return (
    <group>
      <hemisphereLight args={['#ffd6a0', '#4a6fa5', 1.15]} />
      <directionalLight
        position={[9, 5, 8]}
        intensity={2.6}
        color="#ffb782"
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={7}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.001}
      />
      <SkyDome top="#ff9e6b" horizon="#ffd6a0" bottom="#ffd6a0" />
      <primitive object={sun} />
      <primitive object={far} position={[0, SEA_Y - 0.25, 0]} />
      <mesh geometry={ocean.geometry} material={toonVC()} receiveShadow />
      <mesh geometry={world} material={toonVC()} receiveShadow castShadow />
      <Particles
        section="about"
        count={36}
        box={{ x: [-6, 6], y: [SEA_Y + 0.1, SEA_Y + 1.2], z: [-0.2, 1.8] }}
        size={0.55}
        color="#ffffff"
        opacity={0.14}
        fall={0}
        drift={0.18}
        seed={33}
      />
      <Holds layout={layout} style={style} />
      <Climber layout={layout} outfit={OUTFITS.coast} />
    </group>
  );
}

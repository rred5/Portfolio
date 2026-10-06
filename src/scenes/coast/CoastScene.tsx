// About & Contact: sea cliff above the ocean at golden hour (spec §7.4).
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
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
import { pick, rng, range } from '../../lib/rng';
import { box, flat, jitter, merge, paintFaces, place, rock } from '../../render/geo';
import { SkyDome } from '../../render/sky';
import { shadowMap } from '../../render/shadows';
import { toonVC } from '../../render/toon';
import { noInk } from '../../state/registry';
import { getState } from '../../state/store';
import { registerAtmosphere } from '../atmosphere';
import { Particles } from '../common/ambient';
import { barrel, dinghy, fishCrate, fishingBoat, pier } from '../common/harbor';
import { Gulls } from '../island/Gulls';
import { wallLayout } from '../layouts';
import { pickKind, sculptHold } from '../wall/holdShapes';
import { Holds, type HoldStyle } from '../wall/Holds';
import { edgeRoll, reliefMesh } from '../wall/surface';
import { coastWall } from '../walls';

/** Sea level, well below the start ledge: the climb starts high on the cliff. */
const SEA_Y = -14;
const ROCK = ['#b8735a', '#a8664f', '#c98a6a', '#9e6049'];

const CHALK = '#fff6ea';

/** Sea-cliff edges and flakes in the rock colour, chalked where hands go. */
const style: HoldStyle = {
  interactive: (r) => sculptHold(r, { kind: pickKind(r, { edge: 1, jug: 1, knob: 1, flake: 1 }), size: 0.3, color: '#f0c29c', top: CHALK, topAmount: 0.6, rough: 0.12 }),
  support: (r) => sculptHold(r, { kind: pickKind(r, { edge: 2, crimp: 1, knob: 1 }), size: range(r, 0.19, 0.23), color: '#e2ac86', top: CHALK, topAmount: 0.45, rough: 0.13 }),
  decor: (r) => sculptHold(r, { kind: pickKind(r, { edge: 2, flake: 1, knob: 1, sloper: 1 }), size: range(r, 0.09, 0.15), color: pick(r, ROCK), top: CHALK, topAmount: 0.05, rough: 0.16 }),
  glow: () => '#35d6ff',
  decorCount: 9,
  decorArea: { u0: -2.5, u1: 2.3, v0: 0.4, v1: 4.2 },
};

/** Per-ledge hash (0..1): how far each 0.82 m band of the cliff's end stops short. */
const ledgeHash = (v: number, salt: number) => {
  const k = Math.floor(v / 0.82);
  const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function buildScene() {
  const def = coastWall;
  const r = rng(707);
  const face = reliefMesh(def, {
    u0: -10,
    u1: 3.5,
    v0: SEA_Y - 0.6,
    vTop: (u) => 6.6 + 0.5 * Math.sin(u * 0.8) + 0.3 * fbm(u, 2, 5),
    nu: 66,
    nv: 60,
    roll: edgeRoll({ top: [1.0, 1.3] }),
    // The cliff's end is squared off ledge by ledge: each 0.82 m band stops at its own point and
    // turns back into the headland, so the edge steps like the ledges instead of a straight cut.
    corner: {
      end: (v) => 3.5 - 0.65 * ledgeHash(v, 1),
      depth: (v) => 2.0 + 0.8 * ledgeHash(v, 2),
      cols: 6,
      flare: 0.25,
      rough: 0.22,
      seed: 31,
    },
    color: (u, v, n) => {
      if (n.y > 0.62 && v > 5.4) return fbm(u * 2, v, 8) > 0 ? '#8cc956' : '#7dbb4a';
      // The end's side faces: the same bands, a shade darker.
      if (n.dot(def.right) > 0.6 && v > SEA_Y + 1.6) return ['#8c5a4a', '#9a644f', '#83533f'][Math.abs(Math.floor(v / 0.82)) % 3]!;
      // Wet, dark rock just above the waterline; the cliff below the ledge keeps its bands.
      if (v < SEA_Y + 1.6) return v < SEA_Y + 0.6 ? '#4a302a' : '#5e3e36';
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
  parts.push(stack(8.6, -5.5, 6.5, 1.1));

  // The cliff's right end steps down into the sea as a rocky shoulder instead of ending in a cut.
  const shoulder = (x: number, z: number, top: number, w: number, d: number) => {
    const g = new IcosahedronGeometry(1, 2);
    jitter(g, 0.09, r);
    const h = top - SEA_Y + 0.8;
    return place(
      paintFaces(flat(g), (c, n) => (n.y > 0.62 && c.y > 0.2 ? '#8cc956' : c.y < -0.55 ? '#5e3e36' : ROCK[Math.abs(Math.floor(c.y * 2.2 + fbm(c.x, c.z, 9))) % 4]!)),
      [x, SEA_Y - 0.8 + h * 0.5, z],
      [0, r() * 0.6, 0],
      [w, h * 0.5, d],
    );
  };
  parts.push(shoulder(3.6, -1.6, 5.4, 1.9, 2.4));
  parts.push(shoulder(5.2, -2.6, 1.5, 2.2, 2.6));
  parts.push(shoulder(7.0, -3.4, -4.0, 2.6, 2.8));
  parts.push(shoulder(9.2, -3.0, -9.5, 2.8, 2.6));
  parts.push(shoulder(11.6, -4.2, -12.6, 2.4, 2.2));

  // Wet boulders along the waterline, darker below the tide mark.
  for (let i = 0; i < 12; i++) {
    const x = range(r, -6, 7.5);
    const z = x > 3.5 ? range(r, -1.5, 2.5) : range(r, 0.6, 2.4);
    if (Math.abs(x - 0.1) < 1.4 && z < 1.6) continue;
    const s = range(r, 0.3, 0.7);
    const g = new IcosahedronGeometry(1, 1);
    jitter(g, 0.2, r);
    parts.push(place(paintFaces(flat(g), (c, n) => (n.y > 0.5 && c.y > 0 ? '#a8664f' : '#5e3e36')), [x, SEA_Y + s * 0.2, z], [0, r() * 3, 0], [s * 1.3, s, s]));
  }
  // The harbour along the coast: a rocky landing, a wooden pier running out to sea with a hut,
  // crates and barrels on it, and fishing boats moored alongside.
  const H: [number, number] = [26, -12];
  const PA = 0.5;
  const along = (d: number, off = 0): [number, number] => [H[0] + Math.cos(PA) * d + Math.sin(PA) * off, H[1] - Math.sin(PA) * d + Math.cos(PA) * off];
  parts.push(place(rock(r, 3, '#8c5a4a', 1, 0.15), [H[0] - 2, SEA_Y - 0.6, H[1] + 1], [0, 0, 0], [1.8, 0.55, 1.6]));
  parts.push(place(pier(22, 2.4, 1.2, 3), [H[0], SEA_Y, H[1]], [0, PA, 0]));
  const hut = along(1.4, -2.2);
  parts.push(place(merge([box(2.2, 1.6, 1.8, '#f4f1ea'), place(box(2.5, 0.2, 2.1, '#2f86c4'), [0, 0.9, 0]), place(box(0.5, 0.9, 0.05, '#6b4a2e'), [0, -0.35, 0.92])]), [hut[0], SEA_Y + 1.2, hut[1]], [0, PA, 0]));
  for (let k = 0; k < 5; k++) {
    const [x, z] = along(4 + k * 2.8, 0.7);
    const g = k % 2 ? place(barrel(), [0, 0, 0], [0, 0, 0], 0.8) : place(fishCrate(r), [0, 0, 0], [0, r(), 0], 0.8);
    parts.push(place(g, [x, SEA_Y + 1.28, z]));
  }
  for (const [d, side, color] of [
    [8, 1, '#e8423c'],
    [14, -1, '#3ee0c5'],
    [20, 1, '#ffd23f'],
  ] as const) {
    const [x, z] = along(d, 2.7 * side);
    parts.push(place(fishingBoat(color), [x, SEA_Y - 0.05, z], [0, PA + r() * 0.2, 0], 7));
  }

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

/** Boats out working: circling slowly on the swell (centre x, z, radius, speed, scale, colour). */
const WORKING: [number, number, number, number, number, string][] = [
  [42, -32, 12, 0.05, 8, '#e8423c'],
  [70, -8, 9, -0.07, 8, '#2f86c4'],
  [28, 12, 6, 0.09, 5, '#3ee0c5'],
];

const GULL_FLOCKS: [number, number, number, number][] = [
  [22, -6, 10, SEA_Y + 16],
  [48, -26, 14, SEA_Y + 22],
];

function WorkingBoats() {
  const boats = useMemo(() => WORKING.map(([, , , , , c], i) => new Mesh(i === 2 ? dinghy(c) : fishingBoat(c), toonVC())), []);
  useFrame((state) => {
    const s = getState();
    if (s.shown !== 'about') return;
    const t = s.env.reduced ? 0 : state.clock.elapsedTime;
    boats.forEach((b, i) => {
      const [cx, cz, rad, speed, scale] = WORKING[i]!;
      const a = i * 2.1 + t * speed;
      b.position.set(cx + Math.cos(a) * rad, SEA_Y - 0.05 + Math.sin(t * 1.3 + i) * 0.12, cz + Math.sin(a) * rad);
      // Bow along the direction of travel, rolling a little on the swell.
      b.rotation.set(Math.sin(t * 1.1 + i) * 0.06, -a - (speed > 0 ? Math.PI / 2 : -Math.PI / 2), Math.sin(t * 0.9 + i * 2) * 0.04);
      b.scale.setScalar(scale);
    });
  });
  return (
    <group>
      {boats.map((b, i) => (
        <primitive key={i} object={b} />
      ))}
    </group>
  );
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
    const off = registerAtmosphere('about', { fog: new Fog('#ffc9a0', 45, 260), background: '#ffc9a0' });
    onReady();
    return () => {
      off();
      noInk.delete(sun);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReady, sun]);

  // The waves rebuild ~16k vertices and their normals on the CPU; phones do it every other frame.
  const frame = useRef(0);
  useFrame((state) => {
    const s = getState();
    if (s.shown !== 'about' || s.env.reduced) return;
    if (s.env.lowPower && frame.current++ % 2) return;
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
        shadow-mapSize={shadowMap(1536)}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={7}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.001}
        shadow-normalBias={0.04}
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
      <WorkingBoats />
      <Gulls section="about" flocks={GULL_FLOCKS} size={2.4} />
      <Holds layout={layout} style={style} />
      <Climber layout={layout} outfit={OUTFITS.coast} />
    </group>
  );
}

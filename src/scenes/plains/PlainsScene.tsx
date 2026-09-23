// Skills: sunny plains, sandstone boulder (spec §7.3).
import { useEffect, useMemo } from 'react';
import { CylinderGeometry, Fog, IcosahedronGeometry, PlaneGeometry, type BufferGeometry } from 'three';
import type { SectionSceneProps } from '../../app/SectionHost';
import { Climber } from '../../climber/Climber';
import { OUTFITS } from '../../climber/outfits';
import { smoothstep } from '../../lib/ease';
import { fbm } from '../../lib/noise';
import { rng, range, type Rng } from '../../lib/rng';
import { box, flat, jitter, merge, paint, paintFaces, place, rock, tree } from '../../render/geo';
import { SkyDome } from '../../render/sky';
import { toonVC } from '../../render/toon';
import { registerAtmosphere } from '../atmosphere';
import { DriftingClouds, GrassTufts } from '../common/ambient';
import { wallLayout } from '../layouts';
import { Holds, type HoldStyle } from '../wall/Holds';
import { irregularRoll, reliefMesh } from '../wall/surface';
import { plainsWall } from '../walls';

const BANDS = ['#e8a15a', '#d98a4a', '#f0b878', '#dd9552'];

function sandstoneHold(r: Rng, w: number, color: string): BufferGeometry {
  const g = new IcosahedronGeometry(1, 0);
  jitter(g, 0.2, r);
  return place(paint(flat(g), color), [0, 0, w * 0.25], [0, 0, 0], [w, w * 0.32, w * 0.45]);
}

const style: HoldStyle = {
  interactive: (r) => sandstoneHold(r, 0.17, '#f6c48a'),
  support: (r) => sandstoneHold(r, range(r, 0.1, 0.13), '#efb679'),
  decor: (r) => (r() < 0.5 ? sandstoneHold(r, range(r, 0.07, 0.12), '#f0b878') : place(rock(r, 0.05, '#9cb86a', 0, 0.3), [0, 0, 0], [0, 0, 0], [1.4, 1, 0.3])),
  decorCount: 20,
  decorArea: { u0: -2.6, u1: 2.6, v0: 0.4, v1: 4.1 },
};

function sandstoneTower(r: Rng, height: number, radius: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  let y = 0;
  let rad = radius;
  let k = 0;
  while (y < height) {
    const h = range(r, 0.8, 1.6);
    const g = new CylinderGeometry(rad * range(r, 0.82, 1), rad, h, 8, 1);
    jitter(g, rad * 0.08, r);
    parts.push(place(paint(flat(g), BANDS[k % BANDS.length]!), [0, y + h / 2, 0], [0, r() * 3, 0]));
    y += h;
    rad *= range(r, 0.8, 0.97);
    k++;
  }
  return merge(parts);
}

function buildScene() {
  const def = plainsWall;
  const r = rng(808);
  const face = reliefMesh(def, {
    u0: -3.8,
    u1: 3.8,
    v0: -0.25,
    vTop: (u) => 4.65 + 0.4 * Math.sin(u * 1.2 + 0.4) + 0.3 * fbm(u, 0.5, 44) - 0.9 * Math.pow(Math.abs(u) / 3.8, 3),
    nu: 50,
    nv: 36,
    roll: irregularRoll({ half: 3.8, band: 1.3, depth: 1.8, amp: 0.55, seed: 45, top: [0.8, 1.1] }),
    color: (u, v, n) => {
      if (n.y > 0.62 && v > 3.6) return fbm(u * 2, v, 7) > 0 ? '#8cc956' : '#7dbb4a';
      const depth = def.surface(u, v);
      if (depth < -0.07) return '#9a5a34';
      if (fbm(u * 1.4 + 3, v * 1.4, 12) > 0.42) return '#9cb86a';
      const band = Math.floor((v + 0.1 * fbm(u, v, 3)) / 0.55);
      return BANDS[((band % BANDS.length) + BANDS.length) % BANDS.length]!;
    },
  });
  // Rock mass behind the face so the silhouette reads as a boulder.
  const backG = new IcosahedronGeometry(1, 2);
  jitter(backG, 0.08, r);
  const back = place(
    paintFaces(flat(backG), (c) => BANDS[Math.abs(Math.floor(c.y * 4)) % BANDS.length]!),
    [0, 1.9, -2.3],
    [0, 0, 0],
    [3.7, 2.8, 2.4],
  );

  // Ground: flat near the wall, rolling hills further out.
  const groundG = new PlaneGeometry(140, 140, 56, 56);
  groundG.rotateX(-Math.PI / 2);
  const gp = groundG.getAttribute('position');
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i);
    const z = gp.getZ(i);
    const d = Math.hypot(x, z * 1.2);
    gp.setY(i, -0.02 + fbm(x * 0.05, z * 0.05, 91) * 5 * smoothstep(8, 30, d) + fbm(x * 0.3, z * 0.3, 92) * 0.12);
  }
  const ground = paintFaces(flat(groundG), (c) => (fbm(c.x * 0.2, c.z * 0.2, 93) > 0.1 ? '#62c046' : '#72d152'));

  const props: BufferGeometry[] = [face, back, ground];
  props.push(place(box(1.5, 0.28, 1.15, '#e4572e'), [0.1, 0.14, 0.95], [0, 0.08, 0]));
  props.push(place(box(1.5, 0.04, 1.15, '#3a4a6b'), [0.1, 0.29, 0.95], [0, 0.08, 0]));
  // Background towers, hoodoos, boulders and trees (sides and behind).
  const towers: [number, number, number, number][] = [
    [-9, -8, 7, 1.6],
    [-14, -22, 11, 2.2],
    [10, -12, 8.5, 1.8],
    [18, -30, 12, 2.6],
    [-24, -40, 14, 3],
    [6, -34, 9, 2],
  ];
  for (const [x, z, h, rad] of towers) props.push(place(sandstoneTower(r, h, rad), [x, -0.3, z]));
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * range(r, 4.5, 16);
    const z = range(r, -26, 6);
    if (Math.abs(x) < 5 && z > -3) continue;
    props.push(place(tree(r, range(r, 1.1, 1.9)), [x, 0, z]));
  }
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    props.push(place(rock(r, range(r, 0.35, 0.8), '#e0955a', 0), [side * range(r, 3.6, 8), 0.2, range(r, -2, 5)]));
  }
  return merge(props);
}

const TUFTS: [number, number, number][] = (() => {
  const r = rng(4);
  const out: [number, number, number][] = [];
  for (let i = 0; i < 44; i++) {
    const x = range(r, -6, 6);
    const z = range(r, 0.3, 5.5);
    if (Math.abs(x) < 1.1 && z < 1.8) continue;
    out.push([x, 0, z]);
  }
  return out;
})();

export default function PlainsScene({ onReady }: SectionSceneProps) {
  const layout = wallLayout('skills');
  const world = useMemo(buildScene, []);
  useEffect(() => {
    const off = registerAtmosphere('skills', { fog: new Fog('#cfefff', 30, 120), background: '#cfefff' });
    onReady();
    return off;
  }, [onReady]);

  return (
    <group>
      <hemisphereLight args={['#dff4ff', '#6bcb4b', 1.2]} />
      <directionalLight
        position={[6, 14, 9]}
        intensity={2.6}
        color="#fff6e0"
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={7}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.001}
      />
      <SkyDome top="#3f9fe6" horizon="#cfefff" bottom="#cfefff" />
      <mesh geometry={world} material={toonVC()} receiveShadow castShadow />
      <DriftingClouds section="skills" count={7} seed={21} area={{ x: [-60, 60], y: [11, 20], z: [-60, -25] }} />
      <GrassTufts section="skills" spots={TUFTS} />
      <Holds layout={layout} style={style} />
      <Climber layout={layout} outfit={OUTFITS.plains} />
    </group>
  );
}

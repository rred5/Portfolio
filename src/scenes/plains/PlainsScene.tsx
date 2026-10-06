// Skills: national-park sandstone terrace above farmland (spec §7.3). The climb is on the upper tier
// of a tall mesa, starting from a ledge high above the plains; past the mesa's end the view drops
// over lower terraces to patchwork wheat fields, a red barn and silo, with buttes on the horizon.
import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, CylinderGeometry, Fog, IcosahedronGeometry, PlaneGeometry, type Vector3 } from 'three';
import type { SectionSceneProps } from '../../app/SectionHost';
import { Climber } from '../../climber/Climber';
import { OUTFITS } from '../../climber/outfits';
import { fbm } from '../../lib/noise';
import { pick, rng, range, type Rng } from '../../lib/rng';
import { box, cylinder, flat, jitter, merge, paint, paintFaces, place, rock } from '../../render/geo';
import { shadowMap } from '../../render/shadows';
import { SkyDome } from '../../render/sky';
import { toonVC } from '../../render/toon';
import { registerAtmosphere } from '../atmosphere';
import { DriftingClouds } from '../common/ambient';
import { barn, farmhouse, fence, field, hayBale, silo, treeRow, type Crop } from '../common/farm';
import { wallLayout } from '../layouts';
import { pickKind, sculptHold } from '../wall/holdShapes';
import { Holds, type HoldStyle } from '../wall/Holds';
import { cliffFace, reliefMesh } from '../wall/surface';
import { plainsWall } from '../walls';

/** Sandstone strata, cream to deep red, bottom to top. */
const BANDS = ['#e8a15a', '#d98446', '#f0b878', '#c96f3b', '#e59f5c', '#f3c792'];
const VARNISH = '#6e3f26';
/** The same strata in shade, for the prow's side. */
const SIDE_BANDS = ['#b8643a', '#a65a33', '#c47044', '#9c5230'];
const CHALK = '#fffaf0';
/** Plains level, far below the start ledge. */
const PLAINS_Y = -22;
/** Lower terrace level, between the ledge and the plains. */
const LOWER_Y = -10;
/** The mesa's right-hand end (x), past which the view opens up. */
const MESA_END = 2.9;
/** Face colour-calming zone around the route, so the holds and climber stand out. */
const ROUTE_ZONE = { u: [-2.2, 2.0], v: [-0.2, 5.0] } as const;

/** Per-strata-unit hash (0..1): how far each 1.2 m unit of the prow stops short of MESA_END. */
const unitHash = (v: number, salt: number) => {
  const k = Math.floor(v / 1.2);
  const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const bandColor = (y: number, x: number) => BANDS[(((Math.floor((y + 0.12 * fbm(x * 0.3, y, 3)) / 0.6) % BANDS.length) + BANDS.length) % BANDS.length)]!;

/**
 * Sandstone features: big pale jugs, huecos and flakes, chalked where hands go, ringed in cyan (the
 * complement of the orange rock); decoys stay small and rock-coloured so the route reads first.
 */
const style: HoldStyle = {
  interactive: (r) => sculptHold(r, { kind: pickKind(r, { jug: 2, pocket: 1, flake: 1 }), size: 0.3, color: '#f7d3a0', top: CHALK, topAmount: 0.6, rough: 0.12 }),
  support: (r) => sculptHold(r, { kind: pickKind(r, { edge: 2, jug: 1, pocket: 1, sloper: 1 }), size: range(r, 0.19, 0.23), color: '#f2c690', top: CHALK, topAmount: 0.45, rough: 0.13 }),
  decor: (r) => sculptHold(r, { kind: pickKind(r, { edge: 2, pocket: 2, sloper: 1, flake: 1 }), size: range(r, 0.09, 0.15), color: pick(r, BANDS), top: CHALK, topAmount: 0.05, rough: 0.16 }),
  glow: () => '#35d6ff',
  decorCount: 9,
  decorArea: { u0: -2.4, u1: 1.9, v0: 0.4, v1: 4.6 },
};

/** Rock colour for any face: strata bands, dark varnish streaks down steep faces, grass on tops. */
function rockColor(y: number, n: Vector3, c: Vector3) {
  if (n.y > 0.62) return fbm(c.x * 0.5, c.z * 0.5, 7) > 0 ? '#9cc95a' : '#b8c96a';
  if (fbm(c.x * 0.9 + c.z * 0.9, y * 0.08, 12) > 0.34) return VARNISH;
  return bandColor(y, c.x + c.z);
}

/** Juniper: a twisted grey trunk with dark green clumps, base at y = 0. */
function juniper(r: Rng, s: number): BufferGeometry {
  const parts: BufferGeometry[] = [
    place(cylinder(0.05, 0.1, 0.7, 5, '#8a7f74'), [0, 0.3, 0], [0, 0, 0.35]),
    place(cylinder(0.04, 0.06, 0.6, 5, '#8a7f74'), [0.3, 0.7, 0], [0, 0, -0.5]),
  ];
  for (const [x, y, z, k] of [
    [-0.1, 0.8, 0, 0.35],
    [0.5, 1.0, 0.05, 0.3],
    [0.2, 1.15, -0.1, 0.28],
  ] as const) {
    parts.push(place(rock(r, k, '#3f7a4a', 1, 0.2), [x, y, z], [0, 0, 0], [1.3, 0.8, 1]));
  }
  return place(merge(parts), [0, 0, 0], [0, 0, 0], s);
}

/** Flat-topped butte made of stacked, shrinking strata tiers, base at y = 0. */
function butte(r: Rng, radius: number, height: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  let y = 0;
  let rad = radius;
  let k = 0;
  while (y < height - 0.01) {
    const h = Math.min(height - y, range(r, height * 0.15, height * 0.3));
    const g = new CylinderGeometry(rad * range(r, 0.9, 0.98), rad, h, 9, 1);
    jitter(g, rad * 0.06, r);
    parts.push(place(paint(flat(g), BANDS[k % BANDS.length]!), [0, y + h / 2, 0], [0, r() * 3, 0]));
    y += h;
    rad *= range(r, 0.72, 0.9);
    k++;
  }
  parts.push(place(paint(flat(new CylinderGeometry(rad, rad, 0.4, 9, 1)), '#b8c96a'), [0, y, 0]));
  return merge(parts);
}

/** A flat ribbon (road, creek) along a polyline, laid on the ground. */
function strip(pts: [number, number][], width: number, color: string, y: (x: number, z: number) => number): BufferGeometry {
  const pos: number[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k]!;
    const [bx, bz] = pts[k + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const nx = (-(bz - az) / len) * width;
    const nz = ((bx - ax) / len) * width;
    const ya = y(ax, az);
    const yb = y(bx, bz);
    pos.push(ax - nx, ya, az - nz, bx + nx, yb, bz + nz, bx - nx, yb, bz - nz, ax - nx, ya, az - nz, ax + nx, ya, az + nz, bx + nx, yb, bz + nz);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return paint(g, color);
}

/** Where the farmstead sits: in the wedge of plains visible past the mesa's end. */
const FARM: [number, number] = [4, -125];

/** Inside the mesa's footprint (hidden under it). */
function underMesa(x: number, z: number) {
  if (z > -0.6 || z < -60) return false;
  const edge = MESA_END - 0.1 + ((z + 1.2) / -58.8) * -(MESA_END - 0.1 + 24);
  return x < edge;
}

function buildScene() {
  const def = plainsWall;
  const r = rng(808);
  const parts: BufferGeometry[] = [];

  // The climbing face: the front of the mesa's upper tier, rising far above the route.
  parts.push(
    reliefMesh(def, {
      u0: -16,
      u1: MESA_END,
      v0: -0.4,
      vTop: (u) => 10.2 + 0.4 * Math.sin(u * 0.6),
      nu: 104,
      nv: 76,
      // The mesa's end is squared off with real thickness: each 1.2 m strata unit stops at its own
      // point, then its side runs 2–3 m back into the rock, so the edge steps like weathered
      // sandstone instead of ending in a flat cut.
      corner: {
        end: (v) => MESA_END - 0.9 * unitHash(v, 1),
        depth: (v) => 2.2 + 1.2 * unitHash(v, 2),
        cols: 7,
        flare: 0.55,
        rough: 0.22,
        seed: 17,
      },
      color: (u, v, n) => {
        if (n.y > 0.62) return v > 9.5 ? '#9cc95a' : '#e9c08a';
        // Cracks and pockets (not the set-back tier above the route) are dark.
        if (v < 4.9 && def.surface(u, v) < -0.2) return '#7a4428';
        // The prow's side faces: a shade darker, streaked with varnish.
        if (n.dot(def.right) > 0.6) return fbm(u * 0.8, v * 0.3, 14) > 0.4 ? VARNISH : SIDE_BANDS[Math.abs(Math.floor(v / 0.6)) % SIDE_BANDS.length]!;
        // Around the route the rock stays in two close tones without varnish, so the holds pop.
        const calm = u > ROUTE_ZONE.u[0] && u < ROUTE_ZONE.u[1] && v > ROUTE_ZONE.v[0] && v < ROUTE_ZONE.v[1];
        if (calm) return fbm(u * 0.9, v * 0.9, 13) > 0.1 ? '#e59f5c' : '#e8a864';
        if (fbm(u * 1.1, v * 0.09, 12) > 0.36) return VARNISH;
        return bandColor(v, u);
      },
    }),
  );
  // The mesa ends in a prow: past the climbing face its side runs away back and to the left, so
  // everything to the right of the wall is open view. Mesa top as a flat polygon.
  const top = new BufferGeometry();
  const T = 10.2;
  // prettier-ignore
  top.setAttribute('position', new BufferAttribute(new Float32Array([
    -60, T, -0.6,  MESA_END + 0.5, T, -2.6,  -24, T, -60,
    -60, T, -0.6,  -24, T, -60,  -60, T, -60,
  ]), 3));
  top.computeVertexNormals();
  parts.push(paint(top, '#b8c96a'));
  parts.push(cliffFace([MESA_END + 0.55, -2.6], [-24, -60], LOWER_Y, 10.4, { segs: 50, rows: 24, rough: 0.7, seed: 31, color: rockColor }));

  // The start ledge (a terrace step), its right end, and the cliff below it.
  const ledgeTop = new PlaneGeometry(20.6, 2.6, 40, 5);
  ledgeTop.rotateX(-Math.PI / 2);
  const lp = ledgeTop.getAttribute('position');
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i) + (MESA_END - 10.1);
    const z = lp.getZ(i) + 1.25;
    lp.setXYZ(i, x, 0.02 * fbm(x * 2, z * 2, 5) - Math.max(0, z - 2.1) * 0.25, z);
  }
  parts.push(paintFaces(flat(ledgeTop), (c) => (fbm(c.x * 0.8, c.z * 0.8, 8) > 0.25 ? '#c9a06a' : '#dcb47c')));
  parts.push(cliffFace([-16, 2.5], [MESA_END + 0.2, 2.5], LOWER_Y, 0.0, { segs: 60, rows: 20, rough: 0.6, seed: 41, color: rockColor }));
  parts.push(cliffFace([MESA_END + 0.2, 2.5], [MESA_END - 0.1, -1.2], LOWER_Y, 0.0, { segs: 8, rows: 20, rough: 0.4, seed: 42, color: rockColor }));

  // Lower terrace: in front of the ledge and out to the right, ending at a cliff down to the
  // plains a little way back, so the farmland spreads out below and beyond.
  parts.push(place(box(60, 0.5, 44, '#c9a86a'), [-16, LOWER_Y - 0.25, 4]));
  parts.push(cliffFace([-46, 26], [14, 26], PLAINS_Y - 0.5, LOWER_Y, { segs: 50, rows: 12, rough: 0.9, seed: 51, color: rockColor }));
  parts.push(cliffFace([14, 26], [14, -18], PLAINS_Y - 0.5, LOWER_Y, { segs: 40, rows: 12, rough: 0.9, seed: 52, color: rockColor }));
  parts.push(cliffFace([14, -18], [-46, -18], PLAINS_Y - 0.5, LOWER_Y, { segs: 50, rows: 12, rough: 0.9, seed: 53, color: rockColor }));
  // Talus and junipers on the lower terrace.
  for (let i = 0; i < 18; i++) {
    const x = range(r, 5, 13);
    const z = range(r, -16, 20);
    parts.push(place(rock(r, range(r, 0.4, 1.2), pick(r, BANDS), 0, 0.3), [x, LOWER_Y, z], [0, r() * 3, 0], [1, 0.6, 1]));
  }
  for (let i = 0; i < 12; i++) parts.push(place(juniper(r, range(r, 1.6, 2.6)), [range(r, 5, 13), LOWER_Y, range(r, -16, 22)], [0, r() * 6, 0]));
  // Junipers along the lower terrace rim, for scale against the plains below.
  for (let i = 0; i < 9; i++) parts.push(place(juniper(r, range(r, 1.8, 2.8)), [range(r, -12, 13), LOWER_Y, range(r, -17.5, -14)], [0, r() * 6, 0]));

  // On the ledge: round desert shrubs in the cracks, a juniper at the far end, and loose blocks.
  for (const [x, z, s] of [
    [-5.2, 1.3, 0.28],
    [-4.1, 2.0, 0.2],
    [-1.8, 1.9, 0.18],
    [1.6, 2.1, 0.22],
    [2.2, 1.0, 0.24],
  ] as const) {
    parts.push(place(rock(r, s, pick(r, ['#6f9e4a', '#86a95a', '#5e8a44']), 1, 0.2), [x, s * 0.45, z], [0, 0, 0], [1.2, 0.8, 1]));
  }
  parts.push(place(juniper(r, 0.95), [MESA_END - 0.2, 0, 2.15], [0, 1.2, 0]));
  for (const [x, z, s] of [
    [-3.4, 1.6, 0.3],
    [-2.6, 2.0, 0.18],
    [2.4, 1.9, 0.22],
  ] as const) {
    parts.push(place(rock(r, s, pick(r, BANDS), 0, 0.3), [x, s * 0.3, z], [0, r() * 3, 0], [1, 0.7, 1]));
  }

  // The plains: patchwork fields, a farmstead, fences, tree lines, a road and a creek.
  const plains = new PlaneGeometry(700, 700, 70, 70);
  plains.rotateX(-Math.PI / 2);
  const pp = plains.getAttribute('position');
  const groundY = (x: number, z: number) => PLAINS_Y + 1.6 * fbm(x * 0.01, z * 0.01, 91) * Math.min(1, Math.hypot(x, z) / 200);
  for (let i = 0; i < pp.count; i++) pp.setY(i, groundY(pp.getX(i), pp.getZ(i)));
  parts.push(paintFaces(flat(plains), (c) => (fbm(c.x * 0.02, c.z * 0.02, 93) > 0.1 ? '#7cc24a' : '#8fd052')));
  const crops: Crop[] = ['wheat', 'wheat', 'green', 'plowed', 'corn', 'wheat'];
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 6; j++) {
      const x = -44 + i * 26 + range(r, -3, 3);
      const z = -32 - j * 28 + range(r, -3, 3);
      if (underMesa(x, z) || Math.hypot(x - FARM[0], z - FARM[1]) < 16) continue;
      parts.push(field(x, z, range(r, 18, 23), range(r, 22, 27), 0.08, pick(r, crops), groundY, 14));
    }
  }
  const [farmX, farmZ] = FARM;
  const fy = groundY(farmX, farmZ);
  parts.push(place(barn(), [farmX, fy, farmZ], [0, 0.55, 0], 8));
  parts.push(place(silo(), [farmX + 8, fy, farmZ - 4], [0, 0, 0], 8));
  parts.push(place(silo(), [farmX + 11.5, fy, farmZ - 2], [0, 0, 0], 6.5));
  parts.push(place(farmhouse(), [farmX + 14, fy, farmZ + 9], [0, 0.5, 0], 7));
  for (let k = 0; k < 7; k++) parts.push(place(hayBale(), [farmX + 6 + k * 3.5 + range(r, -1, 1), fy, farmZ + 16 + range(r, -2, 2)], [0, r(), 0], 1.1));
  parts.push(fence(farmX - 10, farmZ + 12, farmX + 26, farmZ + 12, fy, 4));
  parts.push(fence(farmX + 26, farmZ + 12, farmX + 26, farmZ - 14, fy, 4));
  parts.push(treeRow(r, 20, -26, 20, -200, groundY, 6, 18));
  parts.push(treeRow(r, 170, -24, 30, -24, groundY, 5, 14));
  parts.push(treeRow(r, farmX - 12, farmZ + 16, farmX - 12, farmZ - 20, groundY, 5, 5));
  parts.push(strip([[30, 30], [22, -20], [farmX + 4, farmZ + 12], [farmX + 30, -130], [farmX + 60, -230]], 1.6, '#d9c08a', (x, z) => groundY(x, z) + 0.05));
  parts.push(strip([[200, 40], [150, -5], [110, -20], [90, -70], [120, -130], [100, -200], [140, -300]], 3, '#5ab4e6', (x, z) => groundY(x, z) + 0.04));

  // Buttes and blue hills on the horizon.
  for (const [x, z, rad, h] of [
    [-40, -240, 26, 48],
    [60, -300, 34, 60],
    [160, -250, 22, 38],
    [240, -180, 18, 30],
    [-120, -200, 30, 55],
  ] as const) {
    parts.push(place(butte(r, rad, h), [x, PLAINS_Y, z]));
  }
  for (let i = 0; i < 8; i++) {
    const g = new IcosahedronGeometry(1, 1);
    jitter(g, 0.12, r);
    parts.push(place(paint(flat(g), '#8fb6a0'), [range(r, -250, 350), PLAINS_Y - 8, range(r, -380, -330)], [0, r() * 3, 0], [range(r, 50, 90), range(r, 18, 30), 30]));
  }
  return merge(parts);
}

export default function PlainsScene({ onReady }: SectionSceneProps) {
  const layout = wallLayout('skills');
  const world = useMemo(buildScene, []);
  useEffect(() => {
    const off = registerAtmosphere('skills', { fog: new Fog('#d6ecf5', 60, 420), background: '#d6ecf5' });
    onReady();
    return off;
  }, [onReady]);

  return (
    <group>
      <hemisphereLight args={['#dff4ff', '#c99a5a', 1.2]} />
      <directionalLight
        position={[9, 14, 10]}
        intensity={2.6}
        color="#fff3dc"
        castShadow
        shadow-mapSize={shadowMap(1536)}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={8}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-bias={-0.001}
        shadow-normalBias={0.04}
      />
      <SkyDome top="#3f9fe6" horizon="#d6ecf5" bottom="#d6ecf5" radius={600} />
      <mesh geometry={world} material={toonVC()} receiveShadow castShadow />
      <DriftingClouds section="skills" count={8} seed={21} area={{ x: [-120, 220], y: [14, 30], z: [-220, -80] }} />
      <Holds layout={layout} style={style} />
      <Climber layout={layout} outfit={OUTFITS.plains} />
    </group>
  );
}

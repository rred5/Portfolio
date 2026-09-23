// Projects: indoor gym with a Kilter-style board (spec §7.1).
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  ConeGeometry,
  CylinderGeometry,
  Fog,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  type BufferGeometry,
} from 'three';
import type { SectionSceneProps } from '../../app/SectionHost';
import { Climber } from '../../climber/Climber';
import { OUTFITS } from '../../climber/outfits';
import { rng, range, pick, type Rng } from '../../lib/rng';
import { box, flat, jitter, merge, paint, place } from '../../render/geo';
import { toonRamp, toonVC } from '../../render/toon';
import { noInk } from '../../state/registry';
import { getState } from '../../state/store';
import { registerAtmosphere } from '../atmosphere';
import { wallLayout, type WallLayout } from '../layouts';
import { canvasTexture, inWall } from '../wall/helpers';
import { Holds, type HoldStyle } from '../wall/Holds';
import type { Spot } from '../wall/route';

const HOLD_COLORS = ['#e8e2d4', '#c9c3b6', '#6a6a74', '#a3a3ad', '#d8c6a8'];
const LED = { start: '#35d05a', hand: '#29c6f0', finish: '#ff3fa4' };

function kilterHold(r: Rng, size: number, color: string): BufferGeometry {
  const kind = Math.floor(r() * 4);
  const scale: [number, number, number] =
    kind === 0 ? [1, 0.38, 0.45] : kind === 1 ? [0.9, 0.6, 0.7] : kind === 2 ? [0.42, 1, 0.5] : [0.95, 0.75, 0.38];
  const g = new IcosahedronGeometry(size, 0);
  jitter(g, size * 0.18, r);
  return place(paint(flat(g), color), [0, 0, size * scale[2] * 0.5], [0, 0, 0], scale);
}

const kilterStyle: HoldStyle = {
  interactive: (r) => {
    const g = new IcosahedronGeometry(0.1, 1);
    jitter(g, 0.012, r);
    return place(paint(flat(g), '#f2eee4'), [0, 0, 0.035], [0, 0, 0], [1.25, 0.8, 0.6]);
  },
  support: (r) => kilterHold(r, 0.08, pick(r, HOLD_COLORS)),
  decor: (r) => kilterHold(r, range(r, 0.05, 0.085), pick(r, HOLD_COLORS)),
  glow: (i, n) => (i === 0 ? LED.start : i === n - 1 ? LED.finish : LED.hand),
  decorSpots: (layout: WallLayout, r: Rng) => {
    const avoid: Spot[] = [...layout.route.slots, ...layout.route.supports];
    const out: Spot[] = [];
    for (let u = -1.7; u <= 1.71; u += 0.2) {
      for (let v = 0.12; v <= 3.55; v += 0.2) {
        const s = { u: u + (Math.round(v / 0.2) % 2 ? 0.1 : 0), v };
        if (Math.abs(s.u) > 1.75) continue;
        if (avoid.some((a) => Math.hypot(a.u - s.u, a.v - s.v) < 0.22)) continue;
        if (r() < 0.3) out.push(s);
      }
    }
    return out;
  },
  led: true,
};

function drawMural(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#2b2d42';
  ctx.fillRect(0, 0, w, h);
  const blobs = ['#ff4fa3', '#3ee0c5', '#ffb400', '#6b4eff'];
  const r = rng(9);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = blobs[i % blobs.length]!;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(r() * w, r() * h, 40 + r() * 120, 30 + r() * 90, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = `${Math.round(h * 0.42)}px "Lilita One", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = h * 0.06;
  ctx.strokeStyle = '#151515';
  ctx.strokeText('SEND IT', w / 2, h * 0.52);
  ctx.fillStyle = '#fff8ec';
  ctx.fillText('SEND IT', w / 2, h * 0.52);
  ctx.fillStyle = '#ffd23f';
  for (let i = 0; i < 6; i++) {
    const x = r() * w;
    const y = r() * h;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const rad = k % 2 ? 10 : 24;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.fill();
  }
}

function drawPoster(ctx: CanvasRenderingContext2D, w: number, h: number, bg: string, title: string, sub: string) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#151515';
  ctx.strokeRect(7, 7, w - 14, h - 14);
  ctx.fillStyle = '#151515';
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.62);
  ctx.lineTo(w * 0.42, h * 0.25);
  ctx.lineTo(w * 0.58, h * 0.45);
  ctx.lineTo(w * 0.7, h * 0.33);
  ctx.lineTo(w * 0.88, h * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(w * 0.16)}px "Lilita One", Impact, sans-serif`;
  ctx.fillText(title, w / 2, h * 0.78);
  ctx.font = `800 ${Math.round(w * 0.075)}px Nunito, sans-serif`;
  ctx.fillText(sub, w / 2, h * 0.9);
}

function texturedPlane(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, px = 512) {
  const tex = canvasTexture(px, Math.round((px * h) / w), draw);
  return new Mesh(new PlaneGeometry(w, h), new MeshToonMaterial({ map: tex, gradientMap: toonRamp() }));
}

function buildRoom(layout: WallLayout) {
  const { def } = layout;
  const r = rng(314);
  const parts: BufferGeometry[] = [];

  // Board: plywood panels + seams, steel frame, kickboard (in wall space).
  const panelTones = ['#d9a566', '#d29e5f', '#dcab6c'];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      parts.push(inWall(def, place(box(1.27, 1.25, 0.06, panelTones[(i + j) % 3]!), [-1.27 + i * 1.27, 0.62 + j * 1.25, -0.03])));
    }
  }
  for (const u of [-0.635, 0.635]) parts.push(inWall(def, place(box(0.012, 3.75, 0.01, '#9c7446'), [u, 1.87, 0.002])));
  for (const v of [1.245, 2.495]) parts.push(inWall(def, place(box(3.81, 0.012, 0.01, '#9c7446'), [0, v, 0.002])));
  for (const u of [-1.96, 1.96]) parts.push(inWall(def, place(box(0.12, 3.9, 0.16, '#2b2d42'), [u, 1.87, -0.05])));
  parts.push(inWall(def, place(box(4.04, 0.14, 0.16, '#2b2d42'), [0, 3.8, -0.05])));
  // Kickboard (vertical, below the board).
  parts.push(place(box(3.8, 0.35, 0.05, '#b98a4f'), [0, 0.175, -0.02]));
  // Supports from the board top back to the wall.
  for (const x of [-1.8, 1.8]) {
    const g = box(0.1, 0.1, 2.9, '#2b2d42');
    parts.push(place(g, [x, 3.25, 1.05], [0, 0, 0]));
  }

  // Room: floor mats, walls, ceiling.
  parts.push(place(box(14, 0.3, 12, '#3a4a6b'), [0, -0.12, 5]));
  for (let x = -6; x <= 6; x += 2) parts.push(place(box(0.05, 0.02, 12, '#2c3a57'), [x, 0.04, 5]));
  parts.push(place(box(16, 7, 0.3, '#3b3f5a'), [0, 3.5, -0.55]));
  parts.push(place(box(0.3, 7, 14, '#34384f'), [-6.6, 3.5, 5]));
  parts.push(place(box(0.3, 7, 14, '#34384f'), [6.6, 3.5, 5]));
  parts.push(place(box(16, 0.3, 14, '#2a2d40'), [0, 6.2, 5]));

  // Neighbouring bouldering wall on the right, with coloured holds.
  const nb = place(box(3.4, 4.6, 0.25, '#6c7a96'), [4.6, 2.3, 0.1], [0.12, -0.25, 0]);
  parts.push(nb);
  const nbColors = ['#ff4fa3', '#35d05a', '#ffd23f', '#29c6f0', '#8f5bff'];
  for (let i = 0; i < 26; i++) {
    const hx = range(r, 3.2, 6.0);
    const hy = range(r, 0.5, 4.3);
    const g = kilterHold(r, range(r, 0.06, 0.11), pick(r, nbColors));
    parts.push(place(g, [hx, hy, 0.28 + (4.6 - hy) * 0.1 - (hx - 4.6) * 0.25], [0.12, -0.25, 0]));
  }

  // Crash mat pile and chalk bucket.
  parts.push(place(box(1.6, 0.35, 1.1, '#e4572e'), [-3.4, 0.2, 2.6], [0, 0.2, 0]));
  parts.push(place(box(1.5, 0.35, 1.0, '#3ee0c5'), [-3.35, 0.55, 2.55], [0, -0.1, 0]));
  parts.push(place(paint(flat(new CylinderGeometry(0.2, 0.17, 0.36, 9)), '#f4f1ea'), [-2.3, 0.2, 1.3]));
  parts.push(place(paint(flat(new CylinderGeometry(0.17, 0.17, 0.04, 9)), '#ffffff'), [-2.3, 0.39, 1.3]));

  // Lamp shades.
  for (const [x, z] of [
    [-2.4, 3.4],
    [2.5, 3.6],
  ] as const) {
    parts.push(place(paint(flat(new ConeGeometry(0.42, 0.34, 8, 1, true)), '#151515'), [x, 4.35, z]));
    parts.push(place(paint(flat(new CylinderGeometry(0.01, 0.01, 1.8, 4)), '#151515'), [x, 5.4, z]));
  }
  return merge(parts);
}

export default function GymScene({ onReady }: SectionSceneProps) {
  const layout = wallLayout('projects');
  const room = useMemo(() => buildRoom(layout), [layout]);
  const decor = useMemo(() => {
    const mural = texturedPlane(4.2, 2.4, drawMural);
    mural.position.set(-4.15, 3.2, -0.39);
    const mural2 = texturedPlane(3.2, 2.2, (c, w, h) => {
      drawMural(c, w, h);
    });
    mural2.position.set(-6.44, 2.6, 3.4);
    mural2.rotation.y = Math.PI / 2;
    const p1 = texturedPlane(0.8, 1.1, (c, w, h) => drawPoster(c, w, h, '#ffd23f', 'COMP', 'SAT 7PM'), 256);
    p1.position.set(3.0, 5.0, -0.39);
    const p2 = texturedPlane(0.8, 1.1, (c, w, h) => drawPoster(c, w, h, '#3ee0c5', 'CRIMP', 'CLUB NIGHT'), 256);
    p2.position.set(-2.55, 1.6, -0.39);
    const bulbs = new MeshBasicMaterial({ color: '#fff3c4' });
    const bulbGeo = new IcosahedronGeometry(0.13, 1);
    const lamps = [
      [-2.4, 4.2, 3.4],
      [2.5, 4.2, 3.6],
    ].map(([x, y, z]) => {
      const m = new Mesh(bulbGeo, bulbs);
      m.position.set(x!, y!, z!);
      noInk.add(m);
      return m;
    });
    return { planes: [mural, mural2, p1, p2], lamps, bulbs };
  }, []);

  useEffect(() => {
    const off = registerAtmosphere('projects', { fog: new Fog('#1f2133', 14, 42), background: '#1f2133' });
    onReady();
    return () => {
      off();
      for (const l of decor.lamps) noInk.delete(l);
    };
  }, [onReady, decor]);

  // Ambient: faint shimmer in the lights.
  const t0 = useRef(0);
  useFrame((state) => {
    if (getState().shown !== 'projects') return;
    t0.current = state.clock.elapsedTime;
    const k = getState().env.reduced ? 1 : 0.97 + 0.03 * Math.sin(t0.current * 3.1);
    decor.bulbs.color.setRGB(k, k * 0.95, k * 0.77);
  });

  return (
    <group>
      <hemisphereLight args={['#ffe3a3', '#9a8468', 1.35]} />
      <directionalLight
        position={[2.2, 3.2, 9]}
        intensity={2.3}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={5}
        shadow-camera-bottom={-2}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-bias={-0.001}
      />
      <mesh geometry={room} material={toonVC()} receiveShadow castShadow />
      {decor.planes.map((p, i) => (
        <primitive key={i} object={p} />
      ))}
      {decor.lamps.map((l, i) => (
        <primitive key={`l${i}`} object={l} />
      ))}
      <Holds layout={layout} style={kilterStyle} />
      <Climber layout={layout} outfit={OUTFITS.gym} />
    </group>
  );
}

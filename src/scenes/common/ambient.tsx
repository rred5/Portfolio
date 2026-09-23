// Subtle ambient motion shared by the outdoor scenes (spec §7.5): always slow, behind the wall,
// frozen under reduced motion.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
  type ColorRepresentation,
} from 'three';
import type { SectionId } from '../../content/types';
import { rng, range } from '../../lib/rng';
import { cloud, flat, merge, paint, place } from '../../render/geo';
import { toonVC } from '../../render/toon';
import { noInk } from '../../state/registry';
import { getState } from '../../state/store';

const active = (section: SectionId) => {
  const s = getState();
  return s.shown === section && !s.env.reduced;
};

export function DriftingClouds({
  section,
  count,
  area,
  seed,
  scale = [1.6, 3],
}: {
  section: SectionId;
  count: number;
  area: { x: [number, number]; y: [number, number]; z: [number, number] };
  seed: number;
  scale?: [number, number];
}) {
  const clouds = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({
      geometry: cloud(r, range(r, scale[0], scale[1])),
      x: range(r, ...area.x),
      y: range(r, ...area.y),
      z: range(r, ...area.z),
      speed: range(r, 0.15, 0.35),
    }));
  }, [count, area, seed, scale]);
  const refs = useRef<(Group | null)[]>([]);
  const span = area.x[1] - area.x[0];
  useFrame((state) => {
    if (!active(section)) return;
    const t = state.clock.elapsedTime;
    clouds.forEach((c, i) => {
      const g = refs.current[i];
      if (!g) return;
      const x = ((((c.x - area.x[0] + t * c.speed) % span) + span) % span) + area.x[0];
      g.position.set(x, c.y, c.z);
    });
  });
  return (
    <>
      {clouds.map((c, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)} position={[c.x, c.y, c.z]}>
          <mesh geometry={c.geometry} material={toonVC()} />
        </group>
      ))}
    </>
  );
}

/** Instanced grass tufts that sway gently. */
export function GrassTufts({
  section,
  spots,
  color = '#5cc043',
  seed = 5,
}: {
  section: SectionId;
  spots: [number, number, number][];
  color?: ColorRepresentation;
  seed?: number;
}) {
  const { mesh, base } = useMemo(() => {
    const r = rng(seed);
    const blade = (x: number, z: number, h: number, lean: number) => place(paint(flat(new ConeGeometry(0.07, h, 4, 1)), color), [x, h / 2, z], [lean, 0, lean * 0.6]);
    const tuft = merge([blade(0, 0, 0.34, 0), blade(0.08, 0.03, 0.27, 0.35), blade(-0.08, -0.03, 0.25, -0.35)]);
    const m = new InstancedMesh(tuft, toonVC(), spots.length);
    const base = spots.map(([x, y, z]) => ({ p: new Vector3(x, y, z), s: range(r, 0.8, 1.4), phase: r() * 6, yaw: r() * 6 }));
    return { mesh: m, base };
  }, [spots, color, seed]);
  const m4 = useMemo(() => new Matrix4(), []);
  const q = useMemo(() => new Quaternion(), []);
  const axis = useMemo(() => new Vector3(1, 0, 0.3).normalize(), []);
  const sc = useMemo(() => new Vector3(), []);
  const apply = (t: number) => {
    base.forEach((b, i) => {
      q.setFromAxisAngle(axis, Math.sin(t * 1.4 + b.phase) * 0.09);
      m4.compose(b.p, q, sc.setScalar(b.s));
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  useEffect(() => {
    apply(0);
    noInk.add(mesh);
    return () => void noInk.delete(mesh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh]);
  useFrame((state) => {
    if (active(section)) apply(state.clock.elapsedTime);
  });
  return <primitive object={mesh} />;
}

function softDot(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/** Falling particles (snow) or drifting ones (mist), kept out of the ink pass. */
export function Particles({
  section,
  count,
  box,
  size,
  color,
  opacity,
  fall,
  drift,
  seed,
  additive = false,
}: {
  section: SectionId;
  count: number;
  box: { x: [number, number]; y: [number, number]; z: [number, number] };
  size: number;
  color: ColorRepresentation;
  opacity: number;
  fall: number;
  drift: number;
  seed: number;
  additive?: boolean;
}) {
  const lowPower = getState().env.lowPower;
  const n = lowPower ? Math.ceil(count / 2) : count;
  const { points, seeds } = useMemo(() => {
    const r = rng(seed);
    const pos = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = range(r, ...box.x);
      pos[i * 3 + 1] = range(r, ...box.y);
      pos[i * 3 + 2] = range(r, ...box.z);
      seeds[i] = r() * 10;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    const mat = new PointsMaterial({
      color,
      size,
      map: softDot(),
      transparent: true,
      opacity,
      depthWrite: false,
      sizeAttenuation: true,
      ...(additive ? { blending: AdditiveBlending } : {}),
    });
    const p = new Points(g, mat);
    p.frustumCulled = false;
    return { points: p, seeds };
  }, [n, box, size, color, opacity, seed, additive]);

  useEffect(() => {
    noInk.add(points);
    return () => void noInk.delete(points);
  }, [points]);

  useFrame((state, dt) => {
    if (!active(section)) return;
    const pos = points.geometry.getAttribute('position') as BufferAttribute;
    const arr = pos.array as Float32Array;
    const t = state.clock.elapsedTime;
    const h = box.y[1] - box.y[0];
    const w = box.x[1] - box.x[0];
    for (let i = 0; i < n; i++) {
      const sd = seeds[i]!;
      arr[i * 3 + 1]! -= fall * dt * (0.7 + (sd % 1) * 0.6);
      arr[i * 3]! += (drift + Math.sin(t * 0.6 + sd) * 0.15) * dt;
      if (arr[i * 3 + 1]! < box.y[0]) arr[i * 3 + 1]! += h;
      if (arr[i * 3]! > box.x[1]) arr[i * 3]! -= w;
      if (arr[i * 3]! < box.x[0]) arr[i * 3]! += w;
    }
    pos.needsUpdate = true;
  });
  return <primitive object={points} />;
}

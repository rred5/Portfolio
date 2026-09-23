// Holds on a wall (spec §8): interactive holds with the shared cue (tape + pulsing glow), hover and
// pinned states, plus support and decorative holds merged into one mesh.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BackSide,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type MeshToonMaterial,
} from 'three';
import { motion } from '../../config/motion';
import { damp } from '../../lib/ease';
import { rng, type Rng } from '../../lib/rng';
import { box, merge, place } from '../../render/geo';
import { toonVC, toonVCUnique } from '../../render/toon';
import { holdPositions, noInk, outlineTargets, pickables, type Pickable } from '../../state/registry';
import { getState } from '../../state/store';
import type { WallLayout } from '../layouts';
import type { Spot } from './route';
import { surfaceNormal, toWorld, type WallDef } from './types';

export const CUE = '#ffd23f';

export interface HoldStyle {
  /** Geometry for an interactive hold (painted, centred, +z out of the wall). */
  interactive: (r: Rng, i: number, n: number) => BufferGeometry;
  support: (r: Rng) => BufferGeometry;
  decor: (r: Rng, spot: Spot) => BufferGeometry;
  /** Glow colour per interactive hold (Kilter LEDs); default cue yellow. */
  glow?: (i: number, n: number) => string;
  /** Decorative hold positions; default scatter. */
  decorSpots?: (layout: WallLayout, r: Rng) => Spot[];
  decorCount?: number;
  decorArea?: { u0: number; u1: number; v0: number; v1: number };
  /** Extra geometry at each position (e.g. Kilter LED dots), lit for interactive holds. */
  led?: boolean;
  /** Tape under each interactive hold (default true). */
  tape?: boolean;
  /** Depth offset of holds from the surface. */
  lift?: number;
}

const m4 = new Matrix4();
const xAxis = new Vector3();
const yAxis = new Vector3();
const zAxis = new Vector3();

/** Places `g` on the wall at (u, v), oriented to the local surface. */
export function onWall(def: WallDef, g: BufferGeometry, u: number, v: number, d = 0, spin = 0): BufferGeometry {
  surfaceNormal(def, u, v, zAxis);
  xAxis.copy(def.right).addScaledVector(zAxis, -def.right.dot(zAxis)).normalize();
  yAxis.crossVectors(zAxis, xAxis).normalize();
  if (spin) {
    const c = Math.cos(spin);
    const s = Math.sin(spin);
    const x2 = xAxis.clone().multiplyScalar(c).addScaledVector(yAxis, s);
    const y2 = yAxis.clone().multiplyScalar(c).addScaledVector(xAxis, -s);
    xAxis.copy(x2);
    yAxis.copy(y2);
  }
  const p = toWorld(def, u, v, d);
  m4.makeBasis(xAxis, yAxis, zAxis).setPosition(p);
  g.applyMatrix4(m4);
  return g;
}

function scatter(layout: WallLayout, r: Rng, count: number, area: { u0: number; u1: number; v0: number; v1: number }): Spot[] {
  const avoid: Spot[] = [...layout.route.slots, ...layout.route.supports];
  const out: Spot[] = [];
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    const s = { u: area.u0 + (area.u1 - area.u0) * r(), v: area.v0 + (area.v1 - area.v0) * r() };
    if (avoid.some((a) => Math.hypot(a.u - s.u, a.v - s.v) < 0.32)) continue;
    if (out.some((a) => Math.hypot(a.u - s.u, a.v - s.v) < 0.26)) continue;
    out.push(s);
  }
  return out;
}

interface InteractiveHold {
  id: string;
  mesh: Mesh;
  material: MeshToonMaterial;
  halo: Mesh;
  haloMat: MeshBasicMaterial;
  hit: Mesh;
  glow: Color;
  scale: number;
  hot: number;
}

export function Holds({ layout, style }: { layout: WallLayout; style: HoldStyle }) {
  const { def, route, items } = layout;

  const built = useMemo(() => {
    const r = rng(def.route.seed * 13 + 7);
    const group = new Group();
    const lift = style.lift ?? 0;
    const n = route.slots.length;
    const hitGeo = new SphereGeometry(0.2, 10, 8);
    const hitMat = new MeshBasicMaterial({ visible: false });

    const holds: InteractiveHold[] = route.slots.map((slot, i) => {
      const g = style.interactive(r, i, n);
      g.computeBoundingSphere();
      const center = toWorld(def, slot.u, slot.v, lift);
      const local = g.clone();
      onWall(def, local, slot.u, slot.v, lift);
      local.translate(-center.x, -center.y, -center.z);
      const material = toonVCUnique();
      const mesh = new Mesh(local, material);
      mesh.position.copy(center);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const glow = new Color(style.glow ? style.glow(i, n) : CUE);
      const haloMat = new MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.5, side: BackSide, depthWrite: false });
      const halo = new Mesh(local, haloMat);
      halo.scale.setScalar(1.45);
      mesh.add(halo);
      noInk.add(halo);
      const hit = new Mesh(hitGeo, hitMat);
      hit.position.copy(center);
      group.add(mesh, hit);
      holdPositions.set(items[i]!.id, center.clone());
      return { id: items[i]!.id, mesh, material, halo, haloMat, hit, glow, scale: 1, hot: 0 };
    });

    // Support + decorative holds, tape strips and LED dots: one static mesh.
    const staticParts: BufferGeometry[] = [];
    for (const s of route.supports) staticParts.push(onWall(def, style.support(r), s.u, s.v, lift, (r() - 0.5) * 1.2));
    const area = style.decorArea ?? { u0: -2.4, u1: 2.4, v0: 0.3, v1: def.route.vEnd + 0.8 };
    const decorSpots = style.decorSpots ? style.decorSpots(layout, r) : scatter(layout, r, style.decorCount ?? 18, area);
    for (const s of decorSpots) staticParts.push(onWall(def, style.decor(r, s), s.u, s.v, lift, (r() - 0.5) * 2));
    if (style.tape !== false) {
      for (const slot of route.slots) staticParts.push(onWall(def, place(box(0.2, 0.045, 0.012, CUE), [0, 0, 0.006]), slot.u, slot.v - 0.16, 0, (r() - 0.5) * 0.15));
    }
    if (style.led) {
      const all = [...decorSpots, ...route.supports];
      for (const s of all) staticParts.push(onWall(def, place(box(0.035, 0.035, 0.012, '#3a3a40'), [0, 0, 0.006]), s.u + 0.09, s.v + 0.09, 0));
      route.slots.forEach((s, i) => {
        const c = style.glow ? style.glow(i, n) : CUE;
        staticParts.push(onWall(def, place(box(0.045, 0.045, 0.016, c), [0, 0, 0.008]), s.u + 0.1, s.v + 0.1, 0));
      });
    }
    const staticMesh = new Mesh(merge(staticParts), toonVC());
    staticMesh.castShadow = true;
    staticMesh.receiveShadow = true;
    group.add(staticMesh);
    return { group, holds };
  }, [def, route, items, style, layout]);

  useEffect(() => {
    const regs: Pickable[] = [];
    for (const h of built.holds) {
      const p: Pickable = { kind: 'hold', id: h.id, view: def.section, object: h.hit };
      pickables.add(p);
      regs.push(p);
      outlineTargets.set(`hold:${h.id}`, [h.mesh]);
    }
    return () => {
      for (const p of regs) pickables.delete(p);
      for (const h of built.holds) {
        outlineTargets.delete(`hold:${h.id}`);
        noInk.delete(h.halo);
      }
    };
  }, [built, def.section]);

  const white = useMemo(() => new Color('#ffffff'), []);
  useFrame((state, dt) => {
    const s = getState();
    if (s.shown !== def.section) return;
    const t = state.clock.elapsedTime;
    const k = damp(20, dt);
    const reduced = s.env.reduced;
    for (const h of built.holds) {
      const active = s.hoverItem === h.id || s.pinnedItem === h.id;
      h.hot += ((active ? 1 : 0) - h.hot) * k;
      h.scale = 1 + 0.08 * h.hot;
      h.mesh.scale.setScalar(h.scale);
      h.material.color.copy(white).lerp(h.glow, 0.35 * h.hot);
      h.material.emissive.copy(h.glow).multiplyScalar(0.18 * h.hot);
      const pulse = reduced ? 0.5 : 0.38 + 0.22 * Math.sin((t * Math.PI * 2) / motion.holdPulsePeriod + h.hit.position.x);
      h.haloMat.opacity = pulse * (1 - h.hot) + 0.75 * h.hot;
    }
  });

  return <primitive object={built.group} />;
}

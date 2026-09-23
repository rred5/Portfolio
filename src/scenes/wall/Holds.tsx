// Holds on a wall (spec §8): interactive holds with the shared cue (tape + a pulsing glow ring on the
// wall around the hold), hover and pinned states, plus support and decorative holds merged into one
// mesh.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
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
import { coverDepth, surfaceNormal, toWorld, type WallDef } from './types';

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
  const p = toWorld(def, u, v, d + coverDepth(def, u, v));
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

/**
 * Glow ring drawn on the wall around a hold: a small polar grid that follows the wall relief, so it
 * never floats or cuts into the rock, shaded as a soft ring (a Kilter-style LED ring on the board).
 */
function glowDisc(def: WallDef, u: number, v: number, radius: number): BufferGeometry {
  const rings = 5;
  const segs = 32;
  const pos: number[] = [];
  const rad: number[] = [];
  const pt = (i: number, j: number) => {
    const rr = (i / rings) * radius;
    const a = (j / segs) * Math.PI * 2;
    const pu = u + Math.cos(a) * rr;
    const pv = v + Math.sin(a) * rr;
    const p = toWorld(def, pu, pv, coverDepth(def, pu, pv) + 0.03);
    return [p.x, p.y, p.z, i / rings] as const;
  };
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + 1, j + 1);
      const d = pt(i, j + 1);
      for (const q of [a, b, c, a, c, d]) {
        pos.push(q[0], q[1], q[2]);
        rad.push(q[3]);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aRadius', new BufferAttribute(new Float32Array(rad), 1));
  return g;
}

const glowVert = /* glsl */ `
attribute float aRadius;
varying float vR;
void main() {
  vR = aRadius;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const glowFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uHot;
varying float vR;
void main() {
  float ring = smoothstep(0.5, 0.74, vR) * (1.0 - smoothstep(0.8, 1.0, vR));
  float fill = (1.0 - smoothstep(0.2, 0.85, vR)) * 0.45 * uHot;
  float a = clamp((ring + fill) * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(uColor, a);
}
`;

function glowMaterial(color: Color): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: glowVert,
    fragmentShader: glowFrag,
    uniforms: { uColor: { value: color }, uOpacity: { value: 0.7 }, uHot: { value: 0 } },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
}

interface InteractiveHold {
  id: string;
  mesh: Mesh;
  material: MeshToonMaterial;
  ring: Mesh;
  ringMat: ShaderMaterial;
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
      const center = toWorld(def, slot.u, slot.v, lift + coverDepth(def, slot.u, slot.v));
      const local = g.clone();
      onWall(def, local, slot.u, slot.v, lift);
      local.translate(-center.x, -center.y, -center.z);
      const material = toonVCUnique();
      const mesh = new Mesh(local, material);
      mesh.position.copy(center);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const glow = new Color(style.glow ? style.glow(i, n) : CUE);
      const ringMat = glowMaterial(glow);
      const ring = new Mesh(glowDisc(def, slot.u, slot.v, (g.boundingSphere?.radius ?? 0.1) * 1.35 + 0.05), ringMat);
      ring.renderOrder = 1;
      noInk.add(ring);
      const hit = new Mesh(hitGeo, hitMat);
      hit.position.copy(center);
      group.add(ring, mesh, hit);
      holdPositions.set(items[i]!.id, center.clone());
      return { id: items[i]!.id, mesh, material, ring, ringMat, hit, glow, scale: 1, hot: 0 };
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
        noInk.delete(h.ring);
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
      h.material.color.copy(white).lerp(h.glow, 0.3 * h.hot);
      h.material.emissive.copy(h.glow).multiplyScalar(0.12 * h.hot);
      const pulse = reduced ? 0.85 : 0.75 + 0.2 * Math.sin((t * Math.PI * 2) / motion.holdPulsePeriod + h.hit.position.x);
      h.ringMat.uniforms.uOpacity!.value = pulse * (1 - h.hot) + h.hot;
      h.ringMat.uniforms.uHot!.value = h.hot;
    }
  });

  return <primitive object={built.group} />;
}

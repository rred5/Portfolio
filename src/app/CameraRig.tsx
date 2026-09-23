// Fixed camera per view (spec §10): frames the scene into the free screen area, adds tiny pointer
// parallax, runs the transition camera moves (spec §9), and on mobile shifts the scene up so the
// active hold stays above the bottom sheet (P11).
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import { motion } from '../config/motion';
import type { SectionId } from '../content/types';
import { damp, easeOutCubic } from '../lib/ease';
import { regionFor } from '../scenes/island/layout';
import { framingFor } from '../scenes/layouts';
import { clock, pointer } from '../state/clock';
import { holdPositions } from '../state/registry';
import { getState } from '../state/store';
import { LAYOUT, sceneRect } from './layoutRect';

const DEG = Math.PI / 180;
const UP = new Vector3(0, 1, 0);
const DIVE_APPROACH = new Vector3(0, 2.4, 2.6);

const pos = new Vector3();
const target = new Vector3();
const aim = new Vector3();
const approach = new Vector3();
const offset = new Vector3();
const right = new Vector3();
const projected = new Vector3();

export function CameraRig() {
  const par = useRef({ yaw: 0, pitch: 0 });
  const shift = useRef(0);

  useFrame((state, dt) => {
    const cam = state.camera as PerspectiveCamera;
    const W = state.size.width;
    const H = state.size.height;
    const s = getState();
    const view = s.shown;
    const portrait = W / H < 0.9;
    const f = framingFor(view, portrait);
    const rect = sceneRect(W, H, view, s.env, s.navVariant);

    const t = Math.tan((f.fov * DEG) / 2);
    const rw = Math.max(rect.x1 - rect.x0, 80);
    const rh = Math.max(rect.y1 - rect.y0, 80);
    const distH = (f.fitH / 2 / t) * (H / rh);
    const distW = (f.fitW / 2 / (t * (W / H))) * (W / rw);
    const dist = Math.max(distH, distW);
    const offX = W / 2 - (rect.x0 + rect.x1) / 2;
    const offY = H / 2 - (rect.y0 + rect.y1) / 2;

    target.copy(f.target);
    pos.copy(f.target).addScaledVector(f.dir, dist);

    if (clock.active && clock.kind && clock.kind !== 'fade') {
      const sa = clock.swapAt;
      const p = clock.p;
      if (!clock.swapped) {
        const q = sa > 0 ? p / sa : 1;
        if (clock.kind === 'dive' && view === 'island') {
          // Dash toward the picked region.
          const region = regionFor(clock.to as SectionId);
          aim.copy(region.focus);
          approach.copy(region.focus).add(DIVE_APPROACH);
          const e = Math.pow(q, 2.1);
          pos.lerp(approach, e);
          target.lerp(aim, e);
        } else {
          // Quick pull back.
          pos.copy(target).addScaledVector(f.dir, dist * (1 + 0.6 * q * q));
        }
      } else {
        // The new scene resolves with a short push-in (or a settle for the island).
        const r = (p - sa) / (1 - sa);
        const amount = clock.kind === 'surface' ? 0.14 : 0.5;
        pos.copy(target).addScaledVector(f.dir, dist * (1 + amount * (1 - easeOutCubic(r))));
      }
    }

    // Pointer parallax: a couple of degrees, desktop only, never under reduced motion.
    const allow = !s.env.reduced && !s.env.touch && pointer.type !== 'touch' && pointer.inside;
    const maxYaw = (view === 'island' ? motion.parallax.islandDeg : motion.parallax.sectionYawDeg) * DEG;
    const maxPitch = (view === 'island' ? motion.parallax.islandDeg : motion.parallax.sectionPitchDeg) * DEG;
    const k = damp(motion.parallax.damping, dt);
    par.current.yaw += ((allow ? -pointer.x * maxYaw : 0) - par.current.yaw) * k;
    par.current.pitch += ((allow ? pointer.y * maxPitch : 0) - par.current.pitch) * k;

    offset.subVectors(pos, target);
    offset.applyAxisAngle(UP, par.current.yaw);
    right.crossVectors(UP, offset).normalize();
    offset.applyAxisAngle(right, par.current.pitch);
    cam.position.copy(target).add(offset);
    cam.up.copy(UP);
    cam.lookAt(target);
    if (cam.fov !== f.fov) cam.fov = f.fov;
    cam.near = 0.1;
    cam.far = 700;

    cam.setViewOffset(W, H, offX, offY + shift.current, W, H);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // Mobile: keep the active hold visible above the bottom sheet (P11).
    let wantShift = 0;
    if (s.env.sheet && s.pinnedItem && view !== 'island' && !clock.active) {
      const hp = holdPositions.get(s.pinnedItem);
      if (hp) {
        projected.copy(hp).project(cam);
        const yPx = (-projected.y * 0.5 + 0.5) * H - shift.current;
        const sheetH = H * LAYOUT.sheetFraction;
        const visibleCenter = (rect.y0 + (H - sheetH)) / 2;
        wantShift = Math.min(Math.max(yPx - visibleCenter, 0), sheetH);
      }
    }
    const ks = s.env.reduced ? 1 : damp(3 / motion.sheetShift, dt);
    const next = shift.current + (wantShift - shift.current) * ks;
    if (Math.abs(next - shift.current) > 0.01) {
      shift.current = next;
      cam.setViewOffset(W, H, offX, offY + shift.current, W, H);
      cam.updateProjectionMatrix();
    }
  }, -1);
  return null;
}

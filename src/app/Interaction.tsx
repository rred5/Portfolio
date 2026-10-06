// Pointer picking for regions and holds (spec §6.3–6.4, §8.4, §13). Hover is mouse/pen only; a tap or
// click on a hold pins its card, on empty scene closes the pinned card.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Raycaster, Vector2, type Object3D } from 'three';
import type { SectionId } from '../content/types';
import { clock, pointer } from '../state/clock';
import { pickables, type Pickable } from '../state/registry';
import { getState } from '../state/store';

const raycaster = new Raycaster();
const ndc = new Vector2();

function pickAt(x: number, y: number, camera: Parameters<Raycaster['setFromCamera']>[1]): Pickable | null {
  const view = getState().shown;
  const list = [...pickables].filter((p) => p.view === view && p.object.visible);
  if (!list.length) return null;
  ndc.set(x, y);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(
    list.map((p) => p.object),
    true,
  );
  for (const h of hits) {
    let o: Object3D | null = h.object;
    while (o) {
      const found = list.find((p) => p.object === o);
      if (found) return found;
      o = o.parent;
    }
  }
  return null;
}

/** Hover set by raycasting (as opposed to DOM labels/tags, which manage their own). */
let rayHover: string | null = null;
let lastView: string | null = null;

export function Interaction() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; t: number } | null = null;

    const toNdc = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const clearRayHover = () => {
      if (!rayHover) return;
      const s = getState();
      if (s.shown === 'island') {
        if (s.hoverRegion === rayHover) s.setHoverRegion(null);
      } else if (s.hoverItem === rayHover) s.setHoverItem(null);
      rayHover = null;
      el.style.cursor = '';
    };

    const onWindowMove = (e: PointerEvent) => {
      toNdc(e);
      pointer.type = e.pointerType;
      pointer.inside = true;
      const overCanvas = e.target === el;
      if (overCanvas) pointer.moved = true;
      else clearRayHover();
    };
    const onLeaveWindow = () => {
      pointer.inside = false;
      clearRayHover();
    };
    const onDown = (e: PointerEvent) => {
      pointer.type = e.pointerType;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 700;
      down = null;
      if (moved > 10 || !quick) return;
      toNdc(e);
      const s = getState();
      if (!s.ready || s.transition) return;
      const hit = pickAt(pointer.x, pointer.y, camera);
      if (s.shown === 'island') {
        if (hit?.kind === 'region') s.navigate(hit.id as SectionId);
      } else if (hit?.kind === 'hold') {
        if (e.pointerType !== 'mouse') s.setHoverItem(null);
        s.pin(hit.id, 'pointer');
      } else {
        s.closeCard();
      }
    };

    window.addEventListener('pointermove', onWindowMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeaveWindow);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onWindowMove);
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
    };
  }, [gl, camera]);

  useFrame(() => {
    const s = getState();
    if (s.shown !== lastView) {
      lastView = s.shown;
      rayHover = null;
      pointer.moved = true;
    }
    if (!pointer.moved) return;
    // Keep the flag while a transition runs, so hover is re-checked as soon as the new view settles.
    if (!s.ready || clock.active) return;
    pointer.moved = false;
    // No real pointer position yet (it defaults to the screen centre): nothing to hover.
    if (!pointer.inside) return;
    if (pointer.type !== 'mouse' && pointer.type !== 'pen') return;
    const hit = pickAt(pointer.x, pointer.y, camera);
    const el = gl.domElement;
    if (s.shown === 'island') {
      const id = hit?.kind === 'region' ? hit.id : null;
      if (id !== rayHover) {
        if (id) {
          s.setHoverRegion(id as SectionId);
          // Save-Data: preload a section only when its region is hovered (spec §15.3).
          s.request(id as SectionId);
        } else if (s.hoverRegion === rayHover) s.setHoverRegion(null);
        rayHover = id;
      }
    } else {
      const id = hit?.kind === 'hold' ? hit.id : null;
      if (id !== rayHover) {
        if (id) s.setHoverItem(id);
        else if (s.hoverItem === rayHover) s.setHoverItem(null);
        rayHover = id;
      }
    }
    el.style.cursor = hit ? 'pointer' : '';
  }, -2);

  return null;
}

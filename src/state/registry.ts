// Mutable registries shared between the 3D scene and the DOM overlay.
import type { Object3D, Vector3 } from 'three';
import type { SectionId } from '../content/types';
import type { ViewId } from './types';

export interface Pickable {
  kind: 'region' | 'hold';
  /** Region: section id. Hold: item id. */
  id: string;
  view: ViewId;
  object: Object3D;
}

/** Objects the pointer can hit, raycast every frame the pointer moves. */
export const pickables = new Set<Pickable>();

/** Meshes that get the white hover/pinned outline, by region or item id. */
export const outlineTargets = new Map<string, Object3D[]>();

/** Objects hidden from the normal pass so they don't get ink lines (particles, glows). */
export const noInk = new Set<Object3D>();

export interface Anchor {
  el: HTMLElement;
  view: ViewId;
  /** World position, read every frame (scenes may animate it, e.g. region lift). */
  pos: Vector3;
  /** Measured width of the element's content (tags beside their hold), cached once laid out. */
  width?: number;
}

/** DOM elements pinned to 3D points (region labels, hold tags). */
export const anchors = new Set<Anchor>();

/** Hold tag buttons by item id, for returning focus after closing a card. */
export const tagButtons = new Map<string, HTMLButtonElement>();

/** World positions of interactive holds (for the mobile camera shift, spec P11). */
export const holdPositions = new Map<string, Vector3>();

/** Section scene roots, toggled visible by the host. */
export const sectionRoots = new Map<SectionId, Object3D>();

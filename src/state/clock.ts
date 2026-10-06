// Per-frame transition values, written by TransitionDriver and read by the camera, scenes and
// post effects. Kept out of React state so nothing re-renders every frame.
import type { TransitionKind, ViewId } from './types';

export const clock = {
  id: -1,
  active: false,
  kind: null as TransitionKind | null,
  from: 'island' as ViewId,
  to: 'island' as ViewId,
  firstDive: false,
  /** Normalized progress 0..1. */
  p: 0,
  swapAt: 0,
  swapped: false,
  t0: 0,
  /** Holding at the swap point because the next scene is still loading. */
  waiting: false,
  /** Envelopes for the post effects. */
  blur: 0,
  lines: 0,
  flash: 0,
  /** Reduced-motion crossfade: snapshot the old frame before swapping. */
  snapshotRequested: false,
  snapshotTaken: false,
};

/** Pointer in normalized device coordinates, updated from DOM events. */
export const pointer = { x: 0, y: 0, inside: false, moved: false, type: 'mouse' as string };

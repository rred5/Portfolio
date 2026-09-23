// App state machine (spec §3.2) and card/hold interaction rules (spec §8.4, §11.3).
import { create } from 'zustand';
import { motion } from '../config/motion';
import { itemById } from '../content/query';
import type { SectionId } from '../content/types';
import { pushView, replaceHash } from './router';
import type { Env, InputSource, NavVariant, Transition, TransitionKind, ViewId } from './types';

export interface AppState {
  ready: boolean;
  loadProgress: number;
  initial: ViewId;
  /** Destination view (matches the URL). */
  view: ViewId;
  /** View currently rendered. Changes at a transition's swap point. */
  shown: ViewId;
  transition: Transition | null;
  hasDived: boolean;

  hoverRegion: SectionId | null;
  hoverItem: string | null;
  pinnedItem: string | null;
  pinSource: InputSource | null;
  /** Last item the climber moved to, per section. The climber stays there (D14). */
  climberItem: Partial<Record<SectionId, string>>;

  /** Section scenes asked to mount (preload or navigation). */
  requested: Partial<Record<SectionId, boolean>>;
  /** Section scenes mounted and compiled. */
  loaded: Partial<Record<SectionId, boolean>>;

  env: Env;
  navVariant: NavVariant;

  init(initial: ViewId, navVariant: NavVariant): void;
  setProgress(p: number): void;
  setReady(): void;
  navigate(to: ViewId, opts?: { history?: 'push' | 'none' }): void;
  swap(): void;
  endTransition(): void;
  setHoverRegion(id: SectionId | null): void;
  setHoverItem(id: string | null): void;
  pin(id: string, source: InputSource): void;
  closeCard(): void;
  request(id: SectionId): void;
  markLoaded(id: SectionId): void;
  setEnv(env: Partial<Env>): void;
}

let transitionIds = 0;

function transitionFor(kind: TransitionKind, firstDive: boolean): { duration: number; swapAt: number } {
  switch (kind) {
    case 'dive':
      return { duration: firstDive ? motion.diveFirst : motion.dive, swapAt: motion.swapAt.dive };
    case 'switch':
      return { duration: motion.switch, swapAt: motion.swapAt.switch };
    case 'surface':
      return { duration: motion.surface, swapAt: motion.swapAt.surface };
    case 'fade':
      return { duration: motion.reducedFade, swapAt: 0 };
  }
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  loadProgress: 0,
  initial: 'island',
  view: 'island',
  shown: 'island',
  transition: null,
  hasDived: false,
  hoverRegion: null,
  hoverItem: null,
  pinnedItem: null,
  pinSource: null,
  climberItem: {},
  requested: {},
  loaded: {},
  env: { touch: false, reduced: false, sheet: false, portrait: false, lowPower: false, saveData: false },
  navVariant: 'rail',

  init(initial, navVariant) {
    set({
      initial,
      view: initial,
      shown: initial,
      navVariant,
      requested: initial === 'island' ? {} : { [initial]: true },
    });
  },

  setProgress(p) {
    if (p > get().loadProgress) set({ loadProgress: p });
  },

  setReady() {
    set({ ready: true, loadProgress: 1 });
  },

  navigate(to, opts) {
    let s = get();
    // A request mid-transition: finish the current one at once and head to the latest target.
    if (s.transition) {
      set({ shown: s.transition.to, transition: null });
      s = get();
    }
    if ((opts?.history ?? 'push') === 'push') pushView(to);
    if (to === s.shown) {
      set({ view: to });
      return;
    }

    const kind: TransitionKind = s.env.reduced
      ? 'fade'
      : s.shown === 'island'
        ? 'dive'
        : to === 'island'
          ? 'surface'
          : 'switch';
    const firstDive = kind === 'dive' && !s.hasDived;
    const { duration, swapAt } = transitionFor(kind, firstDive);
    // The climber in the destination starts at its rest pose (spec §9.3).
    const climberItem = { ...s.climberItem };
    if (to !== 'island') delete climberItem[to];

    set({
      climberItem,
      view: to,
      transition: { id: ++transitionIds, kind, from: s.shown, to, duration, swapAt, firstDive },
      hasDived: s.hasDived || kind === 'dive' || (kind === 'fade' && s.shown === 'island'),
      pinnedItem: null,
      pinSource: null,
      hoverItem: null,
      hoverRegion: null,
      requested: to === 'island' ? s.requested : { ...s.requested, [to]: true },
    });
  },

  swap() {
    const t = get().transition;
    if (t) set({ shown: t.to });
  },

  endTransition() {
    set({ transition: null });
  },

  setHoverRegion(id) {
    if (get().hoverRegion !== id) set({ hoverRegion: id });
  },

  setHoverItem(id) {
    const s = get();
    if (s.hoverItem === id) return;
    if (!id) {
      set({ hoverItem: null });
      return;
    }
    const item = itemById(id);
    if (!item || item.section !== s.shown) return;
    set({ hoverItem: id, climberItem: { ...s.climberItem, [item.section]: id } });
  },

  pin(id, source) {
    const s = get();
    const item = itemById(id);
    if (!item || item.section !== s.shown || s.transition) return;
    // Clicking the already-pinned hold does nothing (P7).
    if (s.pinnedItem === id) return;
    set({ pinnedItem: id, pinSource: source, climberItem: { ...s.climberItem, [item.section]: id } });
    replaceHash(id);
  },

  closeCard() {
    if (!get().pinnedItem) return;
    set({ pinnedItem: null });
    replaceHash(null);
  },

  request(id) {
    if (!get().requested[id]) set({ requested: { ...get().requested, [id]: true } });
  },

  markLoaded(id) {
    if (!get().loaded[id]) set({ loaded: { ...get().loaded, [id]: true } });
  },

  setEnv(env) {
    set({ env: { ...get().env, ...env } });
  },
}));

export const getState = () => useStore.getState();

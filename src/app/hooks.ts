import { useEffect } from 'react';
import { itemById, sectionsInOrder, siblings } from '../content/query';
import { SECTION_IDS } from '../config/sections';
import { tagButtons } from '../state/registry';
import { viewFromPath } from '../state/router';
import { getState, useStore } from '../state/store';
import type { Env } from '../state/types';
import { preloadSceneModule } from './SectionHost';

export function readEnv(): Env {
  const mq = (q: string) => window.matchMedia(q).matches;
  const touch = mq('(hover: none) and (pointer: coarse)');
  const W = window.innerWidth;
  const H = window.innerHeight;
  const portrait = H > W;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return {
    touch,
    reduced: mq('(prefers-reduced-motion: reduce)'),
    sheet: W < 820 || portrait,
    portrait,
    lowPower: touch,
    saveData: !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? ''),
  };
}

/** Keeps env (touch, reduced motion, layout) current (spec §13.1, §15.2). */
export function useEnvironment() {
  useEffect(() => {
    const update = () => getState().setEnv(readEnv());
    update();
    const queries = ['(hover: none) and (pointer: coarse)', '(prefers-reduced-motion: reduce)'].map((q) => window.matchMedia(q));
    for (const q of queries) q.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      for (const q of queries) q.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);
}

/**
 * Browser back/forward runs the normal transitions (spec §3.1). If the history entry carries an item
 * hash, that card is pinned again once the transition has landed.
 */
export function useRouterSync() {
  useEffect(() => {
    let pendingPin = false;
    const onPop = () => {
      getState().navigate(viewFromPath(location.pathname), { history: 'none' });
      if (getState().transition) pendingPin = true;
      else if (!getState().pinnedItem) pinFromHash();
    };
    const unsubscribe = useStore.subscribe((s) => {
      if (pendingPin && !s.transition) {
        pendingPin = false;
        pinFromHash();
      }
    });
    window.addEventListener('popstate', onPop);
    return () => {
      unsubscribe();
      window.removeEventListener('popstate', onPop);
    };
  }, []);
}

/** Esc closes the card, ← → step between items; 1–4 jump to sections, 0 to the island (spec §8.4, §12.3). */
export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const s = getState();
      if (e.key === 'Escape') {
        const pinned = s.pinnedItem;
        const source = s.pinSource;
        if (pinned) {
          s.closeCard();
          if (source === 'keyboard') tagButtons.get(pinned)?.focus();
        }
        return;
      }
      if (!s.ready) return;
      // ← → step through the items of the wall while a card is pinned.
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && s.pinnedItem) {
        const item = itemById(s.pinnedItem);
        const to = item && (e.key === 'ArrowLeft' ? siblings(item).prev : siblings(item).next);
        if (to) {
          e.preventDefault();
          s.pin(to.id, s.pinSource ?? 'keyboard');
        }
        return;
      }
      if (e.key === '0') s.navigate('island');
      const n = Number(e.key);
      if (n >= 1 && n <= sectionsInOrder.length) s.navigate(sectionsInOrder[n - 1]!.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Pins the item named in the URL hash once its section is ready (spec §3.1). */
export function pinFromHash() {
  const id = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!id) return;
  const item = itemById(id);
  const s = getState();
  if (item && item.section === s.shown) s.pin(id, 'pointer');
}

/**
 * Background preload of every section after the island is interactive (P12), one at a time while
 * the browser is idle. With Save-Data or a slow connection, sections load on region hover instead.
 */
export function startPreload() {
  const s = getState();
  if (s.env.saveData) return;
  const idle = (cb: () => void) => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(cb, { timeout: 1500 });
    else setTimeout(cb, 300);
  };
  const queue = SECTION_IDS.filter((id) => !s.requested[id]);
  const next = () => {
    const id = queue.shift();
    if (!id) return;
    idle(() => {
      void preloadSceneModule[id]().then(() => {
        getState().request(id);
        const wait = () => (getState().loaded[id] ? window.setTimeout(next, 250) : window.setTimeout(wait, 100));
        wait();
      });
    });
  };
  next();
}

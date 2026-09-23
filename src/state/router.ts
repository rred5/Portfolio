import { isSectionId } from '../config/sections';
import type { ViewId } from './types';

export function viewFromPath(pathname: string): ViewId {
  const seg = pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
  if (seg === '' || seg === 'index') return 'island';
  return isSectionId(seg) ? seg : 'island';
}

export function pathForView(view: ViewId): string {
  return view === 'island' ? '/' : `/${view}`;
}

const hasWindow = () => typeof window !== 'undefined';

/** Push a new history entry for a view, keeping the query string (e.g. ?nav=dock). */
export function pushView(view: ViewId): void {
  if (!hasWindow()) return;
  const path = pathForView(view);
  if (location.pathname === path && !location.hash) return;
  history.pushState(null, '', path + location.search);
}

/** Pinning replaces the hash without adding history entries (spec §3.1). */
export function replaceHash(itemId: string | null): void {
  if (!hasWindow()) return;
  const url = location.pathname + location.search + (itemId ? `#${itemId}` : '');
  history.replaceState(history.state, '', url);
}

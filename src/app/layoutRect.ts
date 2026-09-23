// Screen-space layout shared by the camera (what area the scene is framed into) and the DOM overlay.
// Values mirror tokens.css.
import type { Env, NavVariant, ViewId } from '../state/types';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const LAYOUT = {
  topbar: 64,
  topbarSheet: 52,
  gutter: 24,
  gutterSheet: 12,
  railW: 72,
  dockH: 76,
  dockHSheet: 68,
  islandTitle: 150,
  islandTitleSheet: 168,
  sheetFraction: 0.45,
};

export const cardWidth = (W: number) => Math.min(440, Math.max(340, W * 0.3));

/** Area of the viewport the scene should be framed into (spec §7, §10, §11). */
export function sceneRect(W: number, H: number, view: ViewId, env: Env, nav: NavVariant): Rect {
  const sheet = env.sheet;
  const gutter = sheet ? LAYOUT.gutterSheet : LAYOUT.gutter;
  if (view === 'island') {
    return { x0: gutter, y0: sheet ? LAYOUT.islandTitleSheet : LAYOUT.islandTitle, x1: W - gutter, y1: H - gutter };
  }
  const y0 = sheet ? LAYOUT.topbarSheet : LAYOUT.topbar;
  if (sheet) {
    return { x0: 0, y0, x1: W, y1: H - (LAYOUT.dockHSheet + gutter) };
  }
  const x1 = W - (cardWidth(W) + gutter * 2);
  if (nav === 'rail') return { x0: LAYOUT.railW + gutter, y0, x1, y1: H - gutter };
  return { x0: 0, y0, x1, y1: H - (LAYOUT.dockH + gutter) };
}

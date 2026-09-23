// Per-view layout lookups: wall + route per section, and camera framings for every view.
import { Vector3 } from 'three';
import { itemsFor } from '../content/query';
import type { Item, SectionId } from '../content/types';
import type { ViewId } from '../state/types';
import { dirFrom, type Framing } from './framing';
import { islandFraming } from './island/layout';
import { buildRoute, type Route } from './wall/route';
import { toWorld, type WallDef } from './wall/types';
import { WALLS } from './walls';

export interface WallLayout {
  def: WallDef;
  route: Route;
  items: Item[];
  /** Slot index by item id. */
  slotOf: Map<string, number>;
}

const cache = new Map<SectionId, WallLayout>();

export function wallLayout(section: SectionId): WallLayout {
  let l = cache.get(section);
  if (!l) {
    const def = WALLS[section];
    const items = itemsFor(section);
    const route = buildRoute(items.length, def);
    const slotOf = new Map(items.map((it, i) => [it.id, i]));
    l = { def, route, items, slotOf };
    cache.set(section, l);
  }
  return l;
}

const framingCache = new Map<string, Framing>();

export function framingFor(view: ViewId, portrait: boolean): Framing {
  const key = `${view}:${portrait}`;
  let f = framingCache.get(key);
  if (!f) {
    if (view === 'island') {
      f = portrait ? islandFraming.portrait : islandFraming.landscape;
    } else {
      const def = WALLS[view];
      const w = portrait ? def.framing.portrait : def.framing.landscape;
      f = {
        target: toWorld(def, w.u, w.v, w.d, new Vector3()),
        dir: dirFrom(w.yaw, w.pitch),
        fitW: w.fitW,
        fitH: w.fitH,
        fov: w.fov,
      };
    }
    framingCache.set(key, f);
  }
  return f;
}

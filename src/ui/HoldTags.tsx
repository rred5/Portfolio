// Always-visible name tags on the interactive holds (D12, spec §8.2). They are the keyboard and
// screen-reader path to the holds: focus = hover, Enter/Space = pin (spec §8.4).
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { sectionById } from '../content/query';
import type { SectionId } from '../content/types';
import { wallLayout } from '../scenes/layouts';
import { toWorld } from '../scenes/wall/types';
import { tagButtons } from '../state/registry';
import { useStore } from '../state/store';
import { Anchored } from './Anchored';
import { PinIcon } from './icons';

export type TagSide = 'below' | 'left' | 'right';

/**
 * Where each interactive hold's tag goes. On the board it hangs just below the hold. On the natural
 * walls, where the climber hangs straight under the hold being used, it sits level with the hold on
 * the side away from the climbing line, so it never covers the climber's head.
 */
export function tagAnchors(section: SectionId): { pos: Vector3; side: TagSide }[] {
  const { def, route } = wallLayout(section);
  if (def.route.shape === 'up-traverse') {
    return route.slots.map((slot) => ({ pos: toWorld(def, slot.u, slot.v - 0.2, 0.1, new Vector3()), side: 'below' }));
  }
  const [l0, l1] = def.route.lane ?? [0, 0];
  const { vStart, vEnd } = def.route;
  return route.slots.map((slot) => {
    const t = Math.min(1, Math.max(0, (slot.v - vStart) / (vEnd - vStart)));
    const side: TagSide = slot.u < l0 + (l1 - l0) * t ? 'left' : 'right';
    const du = side === 'left' ? -0.24 : 0.24;
    return { pos: toWorld(def, slot.u + du, slot.v, 0.1, new Vector3()), side };
  });
}

function SectionTags({ section }: { section: SectionId }) {
  const { items } = wallLayout(section);
  const anchors = useMemo(() => tagAnchors(section), [section]);
  const hoverItem = useStore((s) => s.hoverItem);
  const pinnedItem = useStore((s) => s.pinnedItem);
  const setHoverItem = useStore((s) => s.setHoverItem);
  const pin = useStore((s) => s.pin);
  const label = sectionById(section).label;

  return (
    <nav className="hold-tags" aria-label={`${label} holds`}>
      {items.map((item, i) => {
        const pinned = pinnedItem === item.id;
        return (
          <Anchored key={item.id} view={section} pos={anchors[i]!.pos} className={`anchor--tag anchor--tag-${anchors[i]!.side}`}>
            <button
              type="button"
              ref={(el) => {
                if (el) tagButtons.set(item.id, el);
                else tagButtons.delete(item.id);
              }}
              className="hold-tag"
              data-hover={hoverItem === item.id ? '1' : '0'}
              data-pinned={pinned ? '1' : '0'}
              aria-pressed={pinned}
              aria-label={`${item.tag}, ${label} ${i + 1} of ${items.length}`}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse' || e.pointerType === 'pen') setHoverItem(item.id);
              }}
              onPointerLeave={(e) => {
                if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && useStore.getState().hoverItem === item.id) setHoverItem(null);
              }}
              onFocus={() => setHoverItem(item.id)}
              onBlur={() => {
                if (useStore.getState().hoverItem === item.id) setHoverItem(null);
              }}
              onClick={(e) => pin(item.id, e.detail === 0 ? 'keyboard' : 'pointer')}
            >
              {pinned && <PinIcon />}
              <span>{item.tag}</span>
            </button>
          </Anchored>
        );
      })}
    </nav>
  );
}

export function HoldTags() {
  const shown = useStore((s) => s.shown);
  if (shown === 'island') return null;
  return <SectionTags key={shown} section={shown} />;
}

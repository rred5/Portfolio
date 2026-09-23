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

/** Tape/tag position, just below each interactive hold. */
export function tagAnchors(section: SectionId): Vector3[] {
  const { def, route } = wallLayout(section);
  return route.slots.map((slot) => toWorld(def, slot.u, slot.v - 0.2, 0.1, new Vector3()));
}

function SectionTags({ section }: { section: SectionId }) {
  const { items } = wallLayout(section);
  const positions = useMemo(() => tagAnchors(section), [section]);
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
          <Anchored key={item.id} view={section} pos={positions[i]!} className="anchor--tag">
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

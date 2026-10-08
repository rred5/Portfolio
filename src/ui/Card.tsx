// Information card (spec §11) and its mobile bottom sheet (spec §13.3).
// Desktop: hover shows a view-only preview (D22), click pins it. Sheet layout: pinned only.
import { useEffect, useRef, useState } from 'react';
import { motion } from '../config/motion';
import { sectionStyle } from '../config/sections';
import { itemById, sectionById, siblings } from '../content/query';
import type { Item } from '../content/types';
import { tagButtons } from '../state/registry';
import { getState, useStore } from '../state/store';
import { CardBody, cardHeader } from './CardContent';
import { CloseIcon } from './icons';

type Mode = 'preview' | 'pinned';

/** Keeps the last value around while it animates out. */
function usePresence<T>(value: T | null, outMs: number): [T | null, boolean] {
  const [shown, setShown] = useState<T | null>(value);
  const last = useRef<T | null>(value);
  useEffect(() => {
    if (value) {
      last.current = value;
      setShown(value);
      return;
    }
    const t = window.setTimeout(() => setShown(null), outMs);
    return () => window.clearTimeout(t);
  }, [value, outMs]);
  return [value ?? (shown ? last.current : null), !!value];
}

function closeFromCard() {
  const s = getState();
  const pinned = s.pinnedItem;
  const source = s.pinSource;
  s.closeCard();
  if (pinned && source === 'keyboard') tagButtons.get(pinned)?.focus();
}

function CardInner({ item, mode, onClose, closeRef }: { item: Item; mode: Mode; onClose: () => void; closeRef?: React.Ref<HTMLButtonElement> }) {
  const head = cardHeader(item);
  const section = sectionById(item.section);
  return (
    <>
      <header className="card__head">
        <p className="card__eyebrow">{section.label}</p>
        <h2 className="card__title" id="card-title">
          {head.title}
        </h2>
        {head.subtitle && <p className="card__subtitle">{head.subtitle}</p>}
        {head.meta && <p className="card__meta">{head.meta}</p>}
        {mode === 'pinned' && (
          <button ref={closeRef} type="button" className="card__close" aria-label="Close card" onClick={onClose}>
            <CloseIcon />
          </button>
        )}
      </header>
      <div className="card__body">
        <CardBody item={item} preview={mode === 'preview'} />
      </div>
      {mode === 'pinned' && <CardSteps item={item} />}
    </>
  );
}

/** Previous / next item on the same wall (also ← → keys); the climber moves along with it. */
function CardSteps({ item }: { item: Item }) {
  const pin = useStore((s) => s.pin);
  const { prev, next } = siblings(item);
  if (!prev && !next) return null;
  return (
    <nav className="card__steps" aria-label="More in this section">
      {prev && (
        <button type="button" className="step-btn" aria-label={`Previous: ${prev.tag}`} onClick={(e) => pin(prev.id, e.detail === 0 ? 'keyboard' : 'pointer')}>
          <span aria-hidden="true">‹</span> <span className="step-btn__label">{prev.tag}</span>
        </button>
      )}
      {next && (
        <button type="button" className="step-btn step-btn--next" aria-label={`Next: ${next.tag}`} onClick={(e) => pin(next.id, e.detail === 0 ? 'keyboard' : 'pointer')}>
          <span className="step-btn__label">{next.tag}</span> <span aria-hidden="true">›</span>
        </button>
      )}
    </nav>
  );
}

function ColumnCard({ item, mode, visible }: { item: Item; mode: Mode; visible: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const pinSource = useStore((s) => s.pinSource);
  useEffect(() => {
    if (mode === 'pinned' && pinSource === 'keyboard') closeRef.current?.focus();
  }, [mode, pinSource, item.id]);
  const accent = sectionStyle[item.section].accent;
  return (
    <aside
      className="card"
      data-mode={mode}
      data-state={visible ? 'in' : 'out'}
      role="dialog"
      aria-modal="false"
      aria-labelledby="card-title"
      aria-hidden={mode === 'preview' ? true : undefined}
      style={{ '--accent': accent, '--out': `${motion.previewOut}s`, '--in': `${motion.previewIn}s` } as React.CSSProperties}
    >
      <CardInner item={item} mode={mode} onClose={closeFromCard} closeRef={closeRef} />
    </aside>
  );
}

function SheetCard({ item, visible }: { item: Item; visible: boolean }) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pinSource = useStore((s) => s.pinSource);
  useEffect(() => {
    if (pinSource === 'keyboard') closeRef.current?.focus();
  }, [pinSource, item.id]);
  const accent = sectionStyle[item.section].accent;
  const onDown = (e: React.PointerEvent) => {
    start.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (start.current === null) return;
    setDrag(Math.max(0, e.clientY - start.current));
  };
  const onUp = () => {
    if (start.current === null) return;
    start.current = null;
    if (drag > 80) closeFromCard();
    setDrag(0);
  };
  return (
    <aside
      className="sheet"
      data-state={visible ? 'in' : 'out'}
      data-dragging={drag > 0 ? '1' : '0'}
      role="dialog"
      aria-modal="false"
      aria-labelledby="card-title"
      style={{ '--accent': accent, transform: drag ? `translateY(${drag}px)` : undefined } as React.CSSProperties}
    >
      <div className="sheet__grip" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="sheet__handle" aria-hidden="true" />
      </div>
      <CardInner item={item} mode="pinned" onClose={closeFromCard} closeRef={closeRef} />
    </aside>
  );
}

export function CardHost() {
  const shown = useStore((s) => s.shown);
  const pinned = useStore((s) => s.pinnedItem);
  const hover = useStore((s) => s.hoverItem);
  const sheet = useStore((s) => s.env.sheet);
  const transitioning = useStore((s) => !!s.transition);

  const inSection = shown !== 'island' && !transitioning;
  const id = inSection ? (pinned ?? (sheet ? null : hover)) : null;
  const mode: Mode = pinned ? 'pinned' : 'preview';
  const key = id ? `${id}|${mode}` : null;
  const [shownKey, visible] = usePresence(key, mode === 'preview' ? motion.previewOut * 1000 : 160);
  if (!shownKey) return null;
  const [itemId, shownMode] = shownKey.split('|') as [string, Mode];
  const item = itemById(itemId);
  if (!item) return null;
  return sheet ? <SheetCard item={item} visible={visible} /> : <ColumnCard item={item} mode={shownMode} visible={visible} />;
}

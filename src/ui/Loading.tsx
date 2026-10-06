// Loading screen (spec §15.4) and the spinner shown if a transition has to wait at its swap point
// for the next scene (spec §9.5).
import { useEffect, useRef, useState } from 'react';
import { motion } from '../config/motion';
import { profile } from '../content/query';
import { clock } from '../state/clock';
import { useStore } from '../state/store';

export function LoadingScreen() {
  const ready = useStore((s) => s.ready);
  const progress = useStore((s) => s.loadProgress);
  const initial = useStore((s) => s.initial);
  const [gone, setGone] = useState(false);
  // Direct loads of a section fade in over directEnter (P1); the island uses loadingFade.
  const fade = initial === 'island' ? motion.loadingFade : motion.directEnter;
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setGone(true), fade * 1000 + 50);
    return () => window.clearTimeout(t);
  }, [ready, fade]);
  if (gone) return null;
  return (
    <div className="loading" data-done={ready ? '1' : '0'} style={{ transitionDuration: `${fade}s` }} aria-live="polite">
      <p className="loading__name">{profile.name}</p>
      <p className="loading__sub">{profile.title}</p>
      <div className="loading__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Loading">
        <div className="loading__fill" style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
      </div>
    </div>
  );
}

export function TransitionSpinner() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (ref.current) ref.current.dataset.on = clock.waiting ? '1' : '0';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={ref} className="spinner" data-on="0" aria-hidden="true" />;
}

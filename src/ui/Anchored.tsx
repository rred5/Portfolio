// A DOM element pinned to a 3D point; AnchorSync moves it every frame.
import { useEffect, useRef, type ReactNode } from 'react';
import type { Vector3 } from 'three';
import { anchors } from '../state/registry';
import type { ViewId } from '../state/types';

export function Anchored({ view, pos, className, children }: { view: ViewId; pos: Vector3; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = { el, view, pos };
    anchors.add(a);
    return () => void anchors.delete(a);
  }, [view, pos]);
  return (
    <div ref={ref} className={`anchor ${className ?? ''}`} data-hidden="1">
      {children}
    </div>
  );
}

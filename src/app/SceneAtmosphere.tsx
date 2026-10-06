// Applies the shown view's fog and background.
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Color } from 'three';
import { atmospheres } from '../scenes/atmosphere';
import { getState } from '../state/store';
import type { ViewId } from '../state/types';

export function SceneAtmosphere() {
  const scene = useThree((s) => s.scene);
  const applied = useRef<ViewId | null>(null);
  useFrame(() => {
    const view = getState().shown;
    const a = atmospheres.get(view);
    if (!a) return;
    if (applied.current === view && scene.fog === a.fog) return;
    scene.fog = a.fog;
    scene.background = a.background as Color;
    applied.current = view;
  }, -2);
  return null;
}

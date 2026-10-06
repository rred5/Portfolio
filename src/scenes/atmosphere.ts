// Fog and background per view, applied by SceneAtmosphere when the shown view changes.
import { Color, type ColorRepresentation, type Fog } from 'three';
import type { ViewId } from '../state/types';

export interface Atmosphere {
  fog: Fog;
  background: Color;
}

export const atmospheres = new Map<ViewId, Atmosphere>();

export function registerAtmosphere(view: ViewId, a: { fog: Fog; background: ColorRepresentation }): () => void {
  atmospheres.set(view, { fog: a.fog, background: new Color(a.background) });
  return () => atmospheres.delete(view);
}

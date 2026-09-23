// Mounts a section scene once it's requested (navigation or background preload, spec §15.3),
// precompiles its shaders so the first dive doesn't hitch, and toggles it visible when shown.
import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, lazy, useCallback, useEffect, useRef, type ComponentType } from 'react';
import type { Group } from 'three';
import type { SectionId } from '../content/types';
import { sectionRoots } from '../state/registry';
import { getState, useStore } from '../state/store';

export interface SectionSceneProps {
  onReady: () => void;
}

const SCENES: Record<SectionId, React.LazyExoticComponent<ComponentType<SectionSceneProps>>> = {
  projects: lazy(() => import('../scenes/gym/GymScene')),
  experience: lazy(() => import('../scenes/glacier/GlacierScene')),
  skills: lazy(() => import('../scenes/plains/PlainsScene')),
  about: lazy(() => import('../scenes/coast/CoastScene')),
};

/** Warm the chunk cache without mounting (used by the preloader). */
export const preloadSceneModule: Record<SectionId, () => Promise<unknown>> = {
  projects: () => import('../scenes/gym/GymScene'),
  experience: () => import('../scenes/glacier/GlacierScene'),
  skills: () => import('../scenes/plains/PlainsScene'),
  about: () => import('../scenes/coast/CoastScene'),
};

export function SectionHost({ id }: { id: SectionId }) {
  const requested = useStore((s) => !!s.requested[id]);
  const ref = useRef<Group>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    sectionRoots.set(id, g);
    return () => void sectionRoots.delete(id);
  }, [id, requested]);

  const onReady = useCallback(() => {
    const g = ref.current;
    if (!g) return;
    // Compile with only this scene's lights visible, so the programs match what renders later.
    const others = scene.children.filter((c) => c !== g && c.visible);
    for (const o of others) o.visible = false;
    g.visible = true;
    try {
      gl.compile(scene, camera);
    } finally {
      for (const o of others) o.visible = true;
      g.visible = getState().shown === id;
    }
    getState().markLoaded(id);
  }, [gl, scene, camera, id]);

  useFrame(() => {
    const g = ref.current;
    if (g) g.visible = getState().shown === id;
  }, -2);

  if (!requested) return null;
  const Scene = SCENES[id];
  return (
    <group ref={ref} name={`section-${id}`} visible={false}>
      <Suspense fallback={null}>
        <Scene onReady={onReady} />
      </Suspense>
    </group>
  );
}

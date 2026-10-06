// App root: WebGL check → 3D canvas + DOM overlay.
import { Canvas } from '@react-three/fiber';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { getState, useStore } from '../state/store';
import type { NavVariant, ViewId } from '../state/types';
import { Overlay } from '../ui/Overlay';
import { Experience } from './Experience';
import { readEnv, useEnvironment, useKeyboard, useRouterSync } from './hooks';
import { SNAPSHOT_ID } from './Snapshot';

function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

function navFromUrl(): NavVariant {
  return new URLSearchParams(location.search).get('nav') === 'dock' ? 'dock' : 'rail';
}

/**
 * If the 3D app throws (a scene chunk failing to download, a lost WebGL context during setup),
 * fall back to the text version rather than leaving a blank page.
 */
class FallbackOnError extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error(error);
    location.replace('/text?fallback=error');
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

let initialized = false;

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Dev-only handle for the screenshot scripts.
  void import('../state/clock').then(({ clock, pointer }) => {
    (window as unknown as Record<string, unknown>).__app = { getState, clock, pointer };
  });
}

export default function App({ initial }: { initial: ViewId }) {
  const [webgl] = useState(hasWebGL2);
  if (!initialized) {
    initialized = true;
    const s = getState();
    s.setEnv(readEnv());
    s.init(initial, navFromUrl());
  }
  const lowPower = useStore((s) => s.env.lowPower);

  useEnvironment();
  useRouterSync();
  useKeyboard();

  useEffect(() => {
    // Spec §15.5: no WebGL2 → text version with a note.
    if (!webgl) location.replace('/text?fallback=webgl');
    // The app's own loading screen is mounted now; drop the static one from the HTML.
    else document.getElementById('boot')?.remove();
  }, [webgl]);

  if (!webgl) return null;

  return (
    <FallbackOnError>
      <div className="app">
        <Canvas
          className="app__canvas"
          flat
          shadows="percentage"
          dpr={[1, lowPower ? 1.5 : 2]}
          gl={{ antialias: false, stencil: false, powerPreference: 'high-performance' }}
          camera={{ fov: 35, near: 0.1, far: 700, position: [0, 20, 20] }}
          onCreated={({ gl }) => {
            gl.domElement.setAttribute('aria-hidden', 'true');
          }}
        >
          <Experience />
        </Canvas>
        <canvas id={SNAPSHOT_ID} className="app__snapshot" aria-hidden="true" />
        <Overlay />
      </div>
    </FallbackOnError>
  );
}

// Everything inside the <Canvas>.
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { SECTION_IDS } from '../config/sections';
import { Island } from '../scenes/island/Island';
import { getState } from '../state/store';
import { AnchorSync } from './AnchorSync';
import { CameraRig } from './CameraRig';
import { pinFromHash, startPreload } from './hooks';
import { Interaction } from './Interaction';
import { PostFX } from './PostFX';
import { SceneAtmosphere } from './SceneAtmosphere';
import { SectionHost } from './SectionHost';
import { Snapshot } from './Snapshot';
import { TransitionDriver } from './TransitionDriver';

/** Marks the app ready after the initial view has rendered a couple of frames and fonts are in. */
function ReadyProbe() {
  const frames = useRef(0);
  const fonts = useRef(false);
  const started = useRef(false);
  if (!started.current) {
    started.current = true;
    getState().setProgress(0.35);
    void document.fonts?.ready.then(() => {
      fonts.current = true;
      getState().setProgress(0.6);
    });
  }
  useFrame(() => {
    const s = getState();
    if (s.ready) return;
    const sceneReady = s.initial === 'island' || !!s.loaded[s.initial];
    if (!sceneReady) return;
    s.setProgress(0.85);
    frames.current++;
    if (frames.current >= 3 && (fonts.current || frames.current > 90)) {
      s.setReady();
      pinFromHash();
      window.setTimeout(startPreload, 400);
    }
  }, 4);
  return null;
}

export function Experience() {
  return (
    <>
      <TransitionDriver />
      <SceneAtmosphere />
      <CameraRig />
      <Interaction />
      <Island />
      {SECTION_IDS.map((id) => (
        <SectionHost key={id} id={id} />
      ))}
      <AnchorSync />
      <PostFX />
      <Snapshot />
      <ReadyProbe />
    </>
  );
}

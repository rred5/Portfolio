// Reduced-motion crossfade (spec §9.5, §15.2): copy the last frame of the old scene into a 2D canvas
// overlay, swap scenes underneath, then fade the overlay out.
import { useFrame, useThree } from '@react-three/fiber';
import { motion } from '../config/motion';
import { clock } from '../state/clock';

export const SNAPSHOT_ID = 'scene-snapshot';

export function Snapshot() {
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    if (!clock.snapshotRequested || clock.snapshotTaken) return;
    const overlay = document.getElementById(SNAPSHOT_ID) as HTMLCanvasElement | null;
    clock.snapshotTaken = true;
    if (!overlay) return;
    const src = gl.domElement;
    overlay.width = src.width;
    overlay.height = src.height;
    overlay.getContext('2d')?.drawImage(src, 0, 0);
    overlay.style.transition = 'none';
    overlay.style.opacity = '1';
    void overlay.offsetWidth;
    overlay.style.transition = `opacity ${motion.reducedFade}s linear`;
    overlay.style.opacity = '0';
  }, 2);
  return null;
}

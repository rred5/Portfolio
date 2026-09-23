// Positions DOM labels/tags over their 3D anchors every frame (spec §6.2, §8.2).
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { clock } from '../state/clock';
import { anchors } from '../state/registry';
import { getState } from '../state/store';

const v = new Vector3();
/** Closest a tag beside its hold may come to the edge of the screen. */
const EDGE = 6;

export function AnchorSync() {
  useFrame((state) => {
    const s = getState();
    const W = state.size.width;
    const H = state.size.height;
    const hideAll = clock.active || !s.ready;
    for (const a of anchors) {
      let hidden = hideAll || a.view !== s.shown;
      if (!hidden) {
        v.copy(a.pos).project(state.camera);
        hidden = v.z > 1;
        if (!hidden) {
          let x = (v.x * 0.5 + 0.5) * W;
          const y = (-v.y * 0.5 + 0.5) * H;
          // A tag beside its hold slides in rather than run off the screen (over its own hold's
          // ring, never across to the climber's side).
          const left = a.el.classList.contains('anchor--tag-left');
          if (left || a.el.classList.contains('anchor--tag-right')) {
            if (!a.width) a.width = (a.el.firstElementChild as HTMLElement | null)?.offsetWidth || 0;
            x = left ? Math.max(x, a.width + EDGE) : Math.min(x, W - a.width - EDGE);
          }
          a.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        }
      }
      const flag = hidden ? '1' : '0';
      if (a.el.dataset.hidden !== flag) a.el.dataset.hidden = flag;
    }
  }, 3);
  return null;
}

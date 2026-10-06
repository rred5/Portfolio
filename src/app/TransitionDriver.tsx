// Advances the active transition every frame (spec §9): progress, swap point (waiting for the next
// scene if it isn't loaded yet), and the blur / speed-line / flash envelopes.
import { useFrame } from '@react-three/fiber';
import { clock } from '../state/clock';
import { getState } from '../state/store';

export function TransitionDriver() {
  useFrame(() => {
    const s = getState();
    const tr = s.transition;
    const now = performance.now() / 1000;
    if (!tr) {
      clock.active = false;
      clock.kind = null;
      clock.blur = clock.lines = clock.flash = 0;
      clock.waiting = false;
      return;
    }
    if (clock.id !== tr.id) {
      clock.id = tr.id;
      clock.active = true;
      clock.kind = tr.kind;
      clock.from = tr.from;
      clock.to = tr.to;
      clock.firstDive = tr.firstDive;
      clock.swapAt = tr.swapAt;
      clock.t0 = now;
      clock.swapped = false;
      clock.waiting = false;
      clock.snapshotRequested = tr.kind === 'fade';
      clock.snapshotTaken = false;
    }

    let p = (now - clock.t0) / tr.duration;
    if (!clock.swapped && p >= tr.swapAt) {
      const ready = tr.to === 'island' || !!s.loaded[tr.to];
      const snapshotOk = tr.kind !== 'fade' || clock.snapshotTaken;
      if (ready && snapshotOk) {
        s.swap();
        clock.swapped = true;
        clock.waiting = false;
      } else {
        // Hold at peak blur until the next scene is ready (spec §9.5).
        p = tr.swapAt;
        clock.t0 = now - tr.swapAt * tr.duration;
        clock.waiting = !ready;
      }
    }
    if (clock.swapped && p >= 1) {
      s.endTransition();
      p = 1;
    }
    clock.p = Math.min(1, Math.max(0, p));

    if (tr.kind === 'fade') {
      clock.blur = clock.lines = clock.flash = 0;
      return;
    }
    const sa = tr.swapAt;
    const pre = !clock.swapped;
    const q = pre ? (sa > 0 ? clock.p / sa : 1) : (clock.p - sa) / (1 - sa);
    const env = pre ? Math.pow(q, 1.6) : Math.pow(1 - q, 1.8);
    const lowPower = s.env.lowPower;
    // Phones swap the zoom blur for speed lines + a quick fade (spec §13.4).
    clock.blur = lowPower ? 0 : env * (tr.kind === 'dive' ? 1 : 0.8);
    clock.lines = env * (tr.kind === 'surface' ? 0.6 : 1);
    const peak = lowPower ? 0.55 : 0.14;
    clock.flash = peak * Math.exp(-Math.pow((clock.p - sa) / 0.1, 2));
  }, -3);
  return null;
}

// Lead rope for the roped walls (glacier, sea cliff): protection placed up the wall beside the
// route (ice screws or bolted quickdraws), and a rope from the climber's harness down through every
// piece below them to a coiled pile at the base.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CatmullRomCurve3, Mesh, TorusGeometry, TubeGeometry, Vector3, type BufferGeometry } from 'three';
import { box, cylinder, merge, paint, place } from '../render/geo';
import { toon, toonVC } from '../render/toon';
import type { WallLayout } from '../scenes/layouts';
import { onWall } from '../scenes/wall/Holds';
import { toWorld } from '../scenes/wall/types';
import { getState } from '../state/store';
import { harnessPos } from './Climber';

export interface RopeStyle {
  color: string;
  protection: 'bolt' | 'screw';
  /** Heights (wall v) of the protection pieces. */
  levels: number[];
  /** Where the rope pile sits (world). */
  pile: [number, number, number];
}

/** Hanger + quickdraw hanging below it; +z out of the wall, rope clips at the bottom (y ≈ -0.13). */
function quickdraw(style: RopeStyle): BufferGeometry {
  const parts: BufferGeometry[] =
    style.protection === 'screw'
      ? [
          place(cylinder(0.016, 0.016, 0.08, 6, '#c9d2e0'), [0, 0, 0.03], [Math.PI / 2, 0, 0]),
          place(cylinder(0.024, 0.024, 0.015, 8, '#ff5a36'), [0, 0, 0.07], [Math.PI / 2, 0, 0]),
        ]
      : [place(box(0.035, 0.05, 0.012, '#9aa0b0'), [0, 0, 0.006])];
  parts.push(place(box(0.022, 0.1, 0.012, '#6b4eff'), [0, -0.07, 0.03]));
  parts.push(place(paint(new TorusGeometry(0.022, 0.006, 4, 10).toNonIndexed(), '#c9d2e0'), [0, -0.13, 0.03], [0, Math.PI / 2, 0]));
  return merge(parts);
}

/** Protection spots: zig-zag near the route's centre line, nudged clear of the holds. */
function protectionSpots(layout: WallLayout, levels: number[]) {
  const holds = [...layout.route.slots, ...layout.route.supports];
  return levels.map((v, i) => {
    let u = (i % 2 ? 1 : -1) * 0.18;
    for (const tryU of [u, -u, u * 2.2, -u * 2.2]) {
      if (holds.every((h) => Math.hypot(h.u - tryU, h.v - v) > 0.26)) {
        u = tryU;
        break;
      }
    }
    return { u, v };
  });
}

const SEGMENTS = 64;

export function Rope({ layout, style }: { layout: WallLayout; style: RopeStyle }) {
  const { def } = layout;
  const built = useMemo(() => {
    const spots = protectionSpots(layout, style.levels);
    const gear = merge(spots.map((s) => onWall(def, quickdraw(style), s.u, s.v, 0)));
    // Where the rope runs through each quickdraw's lower carabiner.
    const clips = spots.map((s) => ({ v: s.v, p: toWorld(def, s.u, s.v - 0.13, 0.05) }));
    const pileAt = new Vector3(...style.pile);
    const coils = merge(
      [0, 1, 2, 3].map((k) =>
        place(paint(new TorusGeometry(0.2 - k * 0.012, 0.022, 5, 18).toNonIndexed(), style.color), [pileAt.x + k * 0.015, pileAt.y + 0.02 + k * 0.035, pileAt.z], [Math.PI / 2, 0, 0.3 * k]),
      ),
    );
    return { gear, clips, pileAt, coils };
  }, [def, layout, style]);

  const rope = useRef<Mesh>(null);
  const last = useRef(new Vector3(Infinity, 0, 0));
  const material = useMemo(() => toon(style.color), [style.color]);

  useEffect(() => () => rope.current?.geometry.dispose(), []);

  useFrame(() => {
    if (getState().shown !== def.section) return;
    const h = harnessPos[def.section];
    const mesh = rope.current;
    if (!h || !mesh) return;
    // Rebuild only when the climber has moved.
    if (last.current.distanceToSquared(h) < 1e-6) return;
    last.current.copy(h);

    // Harness → every clipped piece below the harness, top to bottom → pile. Slack sags a little
    // between points.
    const harnessV = h.clone().sub(def.origin).dot(def.up);
    const pts: Vector3[] = [h.clone()];
    for (const c of [...built.clips].reverse()) if (c.v < harnessV - 0.1) pts.push(c.p);
    pts.push(built.pileAt.clone().add(new Vector3(0, 0.12, 0)));
    const path: Vector3[] = [pts[0]!];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const mid = a.clone().lerp(b, 0.5);
      mid.addScaledVector(def.up, -0.04 * a.distanceTo(b)).addScaledVector(def.normal, 0.03);
      path.push(mid, b);
    }
    const old = mesh.geometry;
    mesh.geometry = new TubeGeometry(new CatmullRomCurve3(path, false, 'centripetal'), SEGMENTS, 0.014, 5, false);
    old.dispose();
  });

  return (
    <group>
      <mesh geometry={built.gear} material={toonVC()} castShadow />
      <mesh geometry={built.coils} material={toonVC()} castShadow receiveShadow />
      <mesh ref={rope} material={material} castShadow />
    </group>
  );
}

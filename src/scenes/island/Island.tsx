// The landing island (spec §6): four regions that lift on hover, and break apart into the sea when
// another region is picked (spec §9.2).
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  DoubleSide,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  Vector3,
  type DirectionalLight,
} from 'three';
import { motion } from '../../config/motion';
import type { SectionId } from '../../content/types';
import { clamp01, damp } from '../../lib/ease';
import { rng, range } from '../../lib/rng';
import { shadowMap } from '../../render/shadows';
import { toonVC } from '../../render/toon';
import { islandWaterMaterial } from '../../render/water';
import { clock } from '../../state/clock';
import { noInk, outlineTargets, pickables, type Pickable } from '../../state/registry';
import { getState } from '../../state/store';
import { registerAtmosphere } from '../atmosphere';
import { Particles } from '../common/ambient';
import { fishingBoat } from '../common/harbor';
import { buildBoat, buildClouds, buildHub, buildIsland } from './build';
import { Gulls } from './Gulls';
import { REGIONS } from './layout';

/** Label anchors, lifted with their region. Read by the DOM overlay. */
export const regionLabelPos: Record<SectionId, Vector3> = Object.fromEntries(
  REGIONS.map((r) => [r.section, r.label.clone()]),
) as Record<SectionId, Vector3>;

const LIFT_Y = 0.38;
const LIFT_Z = 0.2;

interface ChunkState {
  mesh: Mesh;
  rest: Vector3;
  top: number;
  delay: number;
  axis: Vector3;
  spin: number;
  drift: Vector3;
  ring: Mesh;
  ringMat: MeshBasicMaterial;
  moved: boolean;
}

export function Island() {
  const regions = useMemo(buildIsland, []);
  const clouds = useMemo(buildClouds, []);
  const water = useMemo(islandWaterMaterial, []);
  const scenery = useMemo(() => ({ hub: buildHub(), boat: buildBoat(), fisher: fishingBoat('#ffd23f') }), []);
  const boatRef = useRef<Group>(null);
  const fisherRef = useRef<Group>(null);
  const root = useRef<Group>(null);
  const regionGroups = useRef<Partial<Record<SectionId, Group>>>({});
  const lifts = useRef<Record<string, number>>({});
  const chunkState = useRef<Record<string, ChunkState[]>>({});
  const cloudRefs = useRef<(Group | null)[]>([]);
  const sun = useRef<DirectionalLight>(null);

  // Region meshes, splash rings and per-chunk fall parameters.
  const regionObjects = useMemo(() => {
    const r = rng(4242);
    const ringGeo = new RingGeometry(0.55, 0.8, 18);
    ringGeo.rotateX(-Math.PI / 2);
    return regions.map(({ def, chunks }) => {
      const group = new Group();
      group.name = `region-${def.section}`;
      const states: ChunkState[] = chunks.map((c) => {
        const mesh = new Mesh(c.geometry, toonVC());
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        const ringMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
        const ring = new Mesh(ringGeo, ringMat);
        ring.position.set(c.center.x, 0.03, c.center.z);
        ring.visible = false;
        noInk.add(ring);
        const out = new Vector3(c.center.x, 0, c.center.z).normalize();
        return {
          mesh,
          rest: c.center.clone(),
          top: c.top,
          delay: range(r, 0, 0.22) + c.ring * 0.04,
          axis: new Vector3(range(r, -1, 1), range(r, -0.3, 0.3), range(r, -1, 1)).normalize(),
          spin: range(r, 0.8, 1.8),
          drift: out.multiplyScalar(range(r, 0.3, 1.1)),
          ring,
          ringMat,
          moved: false,
        };
      });
      chunkState.current[def.section] = states;
      return { def, group, rings: states.map((s) => s.ring), meshes: states.map((s) => s.mesh) };
    });
  }, [regions]);

  useEffect(() => {
    const entries: Pickable[] = [];
    for (const r of regionObjects) {
      regionGroups.current[r.def.section] = r.group;
      const p: Pickable = { kind: 'region', id: r.def.section, view: 'island', object: r.group };
      pickables.add(p);
      entries.push(p);
      outlineTargets.set(`region:${r.def.section}`, r.meshes);
    }
    // Fog only darkens far water into the deep colour; it starts beyond the island even for the
    // distant portrait camera.
    const off = registerAtmosphere('island', { fog: new Fog('#1f6fb2', 120, 280), background: '#1f6fb2' });
    return () => {
      for (const p of entries) pickables.delete(p);
      for (const r of regionObjects) {
        outlineTargets.delete(`region:${r.def.section}`);
        for (const ring of r.rings) noInk.delete(ring);
      }
      off();
    };
  }, [regionObjects]);

  useFrame((state, dt) => {
    const s = getState();
    const g = root.current;
    if (!g) return;
    g.visible = s.shown === 'island';
    if (!g.visible) return;

    const diving = clock.active && clock.kind === 'dive' && !clock.swapped;
    const k = damp(3 / motion.regionHover, dt);
    const time = state.clock.elapsedTime;
    water.uniforms.uTime!.value = s.env.reduced ? 0 : time;

    for (const r of regionObjects) {
      const id = r.def.section;
      const selected = diving && clock.to === id;
      const hovered = !clock.active && s.hoverRegion === id;
      const target = selected ? 1.6 : hovered ? 1 : 0;
      const cur = (lifts.current[id] ?? 0) + (target - (lifts.current[id] ?? 0)) * k;
      lifts.current[id] = cur;
      r.group.position.set(0, cur * LIFT_Y, cur * LIFT_Z);
      regionLabelPos[id].copy(r.def.label).add(r.group.position);

      // Chunks of the regions that weren't picked fall into the sea.
      const states = chunkState.current[id]!;
      const falling = diving && !selected;
      for (const c of states) {
        if (!falling) {
          if (c.moved) {
            c.mesh.position.set(0, 0, 0);
            c.mesh.rotation.set(0, 0, 0);
            c.moved = false;
          }
          c.ring.visible = false;
          continue;
        }
        c.moved = true;
        const span = clock.firstDive ? 0.6 : 0.45;
        const f = clamp01((clock.p - 0.05 - c.delay * (clock.firstDive ? 1 : 0.5)) / span);
        const drop = 10 * f * f;
        // Tumble about the chunk's centre: position = centre + offset - rotated centre.
        c.mesh.setRotationFromAxisAngle(c.axis, c.spin * f);
        c.mesh.position.copy(c.rest).applyQuaternion(c.mesh.quaternion).negate().add(c.rest);
        c.mesh.position.x += c.drift.x * f;
        c.mesh.position.y -= drop;
        c.mesh.position.z += c.drift.z * f;
        // Splash when the chunk top reaches the water.
        const enter = Math.sqrt(Math.max(0.05, c.top) / 10);
        const rt = clamp01((f - enter) / 0.35);
        c.ring.visible = f > enter && rt < 1;
        c.ring.scale.setScalar(0.6 + rt * 2.2);
        c.ringMat.opacity = (1 - rt) * 0.85;
      }
    }

    // Sailboat circling the island, bobbing a little.
    const boat = boatRef.current;
    if (boat) {
      const ba = 0.9 + (s.env.reduced ? 0 : time * 0.035);
      boat.position.set(Math.cos(ba) * 15.5, s.env.reduced ? 0 : Math.sin(time * 1.7) * 0.05, Math.sin(ba) * 15.5);
      boat.rotation.set(s.env.reduced ? 0 : Math.sin(time * 1.3) * 0.06, -(ba + Math.PI / 2), 0);
    }

    // A fishing boat working its way round the other way, closer in.
    const fisher = fisherRef.current;
    if (fisher) {
      const fa = 2.6 - (s.env.reduced ? 0 : time * 0.045);
      fisher.position.set(Math.cos(fa) * 13.4, s.env.reduced ? 0 : Math.sin(time * 1.5 + 1) * 0.04, Math.sin(fa) * 13.4);
      fisher.rotation.set(s.env.reduced ? 0 : Math.sin(time * 1.2) * 0.05, -(fa - Math.PI / 2), 0);
    }

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i]!;
      const ref = cloudRefs.current[i];
      if (!ref) continue;
      const a = c.angle + (s.env.reduced ? 0 : time * c.speed);
      ref.position.set(Math.cos(a) * c.radius, c.y, Math.sin(a) * c.radius);
    }
  });

  const waterGeo = useMemo(() => {
    const p = new PlaneGeometry(420, 420, 1, 1);
    p.rotateX(-Math.PI / 2);
    return p;
  }, []);

  return (
    <group ref={root} name="island-root">
      <hemisphereLight args={['#d6f0ff', '#3e8a5a', 1.35]} />
      <directionalLight
        ref={sun}
        position={[-8, 16, 10]}
        intensity={2.3}
        castShadow
        shadow-mapSize={shadowMap(2048)}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0015}
        shadow-normalBias={0.04}
      />
      <mesh geometry={waterGeo} material={water} position={[0, 0, 0]} receiveShadow={false} />
      <mesh geometry={scenery.hub} material={toonVC()} castShadow receiveShadow />
      <group ref={boatRef}>
        <mesh geometry={scenery.boat} material={toonVC()} castShadow />
      </group>
      <group ref={fisherRef} scale={1.3}>
        <mesh geometry={scenery.fisher} material={toonVC()} castShadow />
      </group>
      <Gulls />
      {/* Light snowfall over the glacier region. */}
      <Particles section="island" count={70} box={{ x: [-7.5, -0.8], y: [1, 8], z: [-7.5, -0.8] }} size={0.14} color="#ffffff" opacity={0.9} fall={0.6} drift={0.15} seed={29} />
      {regionObjects.map((r) => (
        <group key={r.def.section}>
          <primitive object={r.group} />
          {r.rings.map((ring, i) => (
            <primitive key={i} object={ring} />
          ))}
        </group>
      ))}
      {clouds.map((c, i) => (
        <group key={i} ref={(el) => void (cloudRefs.current[i] = el)}>
          <mesh geometry={c.geometry} material={toonVC()} />
        </group>
      ))}
    </group>
  );
}

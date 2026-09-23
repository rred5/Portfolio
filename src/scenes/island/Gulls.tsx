// A couple of small gull flocks circling over the island, flapping now and then (island life).
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide, InstancedMesh, Matrix4, MeshToonMaterial, Quaternion, Vector3 } from 'three';
import { rng, range } from '../../lib/rng';
import { toonRamp } from '../../render/toon';
import { getState } from '../../state/store';

/** Two wings meeting at the body, body pointing +z. Flapping flips the wing tips through y. */
function gullGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  // prettier-ignore
  g.setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0, 0.1,  -0.45, 0.16, -0.06,  0, 0, -0.12,
    0, 0, 0.1,  0, 0, -0.12,  0.45, 0.16, -0.06,
  ]), 3));
  g.computeVertexNormals();
  return g;
}

interface Gull {
  cx: number;
  cz: number;
  radius: number;
  y: number;
  speed: number;
  phase: number;
  flap: number;
}

const FLOCKS: [number, number, number, number][] = [
  // centre x, centre z, radius, height
  [-2.5, 1.5, 6.5, 6.2],
  [3.5, -2.5, 5, 7.4],
];

const m = new Matrix4();
const q = new Quaternion();
const p = new Vector3();
const s = new Vector3();
const UP = new Vector3(0, 1, 0);

export function Gulls() {
  const { mesh, gulls } = useMemo(() => {
    const r = rng(61);
    const gulls: Gull[] = [];
    FLOCKS.forEach(([cx, cz, radius, y], f) => {
      const base = r() * Math.PI * 2;
      const dir = f % 2 ? -1 : 1;
      for (let i = 0; i < 3 + f; i++) {
        gulls.push({
          cx,
          cz,
          radius: radius + range(r, -0.8, 0.8),
          y: y + range(r, -0.4, 0.4),
          speed: dir * range(r, 0.22, 0.28),
          phase: base + i * 0.28,
          flap: r() * 10,
        });
      }
    });
    const mat = new MeshToonMaterial({ color: '#ffffff', gradientMap: toonRamp(), side: DoubleSide });
    const mesh = new InstancedMesh(gullGeometry(), mat, gulls.length);
    mesh.frustumCulled = false;
    return { mesh, gulls };
  }, []);

  useFrame((state) => {
    const st = getState();
    if (st.shown !== 'island') return;
    const t = st.env.reduced ? 0 : state.clock.elapsedTime;
    gulls.forEach((g, i) => {
      const a = g.phase + t * g.speed;
      p.set(g.cx + Math.cos(a) * g.radius, g.y + Math.sin(t * 0.7 + g.phase) * 0.25, g.cz + Math.sin(a) * g.radius);
      // Face along the circle.
      const heading = Math.atan2(-Math.sin(a) * Math.sign(g.speed), Math.cos(a) * Math.sign(g.speed));
      q.setFromAxisAngle(UP, heading);
      // Glide most of the time, with a burst of flaps every few seconds.
      const burst = Math.sin(t * 0.9 + g.flap) > 0.4;
      const wing = burst ? Math.sin(t * 14 + g.flap) : 0.7;
      s.set(1.4, wing * 1.4, 1.4);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}

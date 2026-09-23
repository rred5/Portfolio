// Gradient sky dome and a few shared scenery pieces.
import { useMemo } from 'react';
import { BackSide, Color, MeshBasicMaterial, SphereGeometry, type ColorRepresentation } from 'three';
import { paint } from './geo';

export function SkyDome({ top, horizon, bottom, radius = 320 }: { top: ColorRepresentation; horizon: ColorRepresentation; bottom: ColorRepresentation; radius?: number }) {
  const { geometry, material } = useMemo(() => {
    const g = new SphereGeometry(radius, 24, 16);
    const t = new Color(top);
    const h = new Color(horizon);
    const b = new Color(bottom);
    const c = new Color();
    paint(g, (p) => {
      const y = p.y / radius;
      if (y >= 0) return c.copy(h).lerp(t, Math.pow(y, 0.6)).clone();
      return c.copy(h).lerp(b, Math.min(1, -y * 3)).clone();
    });
    const m = new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false });
    return { geometry: g, material: m };
  }, [top, horizon, bottom, radius]);
  return <mesh geometry={geometry} material={material} renderOrder={-1} frustumCulled={false} />;
}

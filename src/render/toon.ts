// Shared cel-shading material (spec §5, §18.3): MeshToonMaterial with vertex colors and a 3-step
// gradient ramp, so every model matches.
import { Color, DataTexture, MeshToonMaterial, NearestFilter, RedFormat, type ColorRepresentation } from 'three';

let ramp: DataTexture | null = null;

export function toonRamp(): DataTexture {
  if (!ramp) {
    ramp = new DataTexture(new Uint8Array([110, 190, 255]), 3, 1, RedFormat);
    ramp.minFilter = NearestFilter;
    ramp.magFilter = NearestFilter;
    ramp.generateMipmaps = false;
    ramp.needsUpdate = true;
  }
  return ramp;
}

let vc: MeshToonMaterial | null = null;

/** The one material for all vertex-colored scenery. */
export function toonVC(): MeshToonMaterial {
  if (!vc) vc = new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
  return vc;
}

const solid = new Map<string, MeshToonMaterial>();

/** Cached single-color toon material. */
export function toon(color: ColorRepresentation): MeshToonMaterial {
  const key = new Color(color).getHexString();
  let m = solid.get(key);
  if (!m) {
    m = new MeshToonMaterial({ color, gradientMap: toonRamp() });
    solid.set(key, m);
  }
  return m;
}

/** A fresh (uncached) vertex-colored toon material, for meshes that tint on hover. */
export function toonVCUnique(): MeshToonMaterial {
  return new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
}

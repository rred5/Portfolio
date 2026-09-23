import { CanvasTexture, Matrix4, SRGBColorSpace, type BufferGeometry } from 'three';
import type { WallDef } from './types';

const m = new Matrix4();

/** Maps geometry built in wall space (x = u, y = v, z = depth) into the world, ignoring relief. */
export function inWall(def: WallDef, g: BufferGeometry): BufferGeometry {
  m.makeBasis(def.right, def.up, def.normal).setPosition(def.origin);
  g.applyMatrix4(m);
  return g;
}

/** Canvas-drawn texture that redraws once web fonts are in (for original murals/posters). */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  void document.fonts?.ready.then(() => {
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
    tex.needsUpdate = true;
  });
  return tex;
}

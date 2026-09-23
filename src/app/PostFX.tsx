// Post-processing chain (spec §5, §18.3): scene → normals → ink outlines + white selection outline →
// zoom blur / speed lines / flash. Renders the frame (priority 1 disables R3F's own render).
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BlendFunction, EffectComposer, EffectPass, KernelSize, OutlineEffect, RenderPass } from 'postprocessing';
import { HalfFloatType, type Object3D } from 'three';
import { InkNormalPass, InkOutlineEffect, ZoomBlurEffect } from '../render/effects';
import { clock } from '../state/clock';
import { outlineTargets } from '../state/registry';
import { getState } from '../state/store';

export function PostFX() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const lowPower = getState().env.lowPower;

  const fx = useMemo(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: HalfFloatType,
      multisampling: lowPower ? 0 : 4,
    });
    const normal = new InkNormalPass(scene, camera);
    const ink = new InkOutlineEffect(normal.texture);
    const outline = new OutlineEffect(scene, camera, {
      blendFunction: BlendFunction.SCREEN,
      edgeStrength: 14,
      pulseSpeed: 0,
      visibleEdgeColor: 0xffffff,
      hiddenEdgeColor: 0xffffff,
      xRay: false,
      blur: true,
      kernelSize: KernelSize.SMALL,
      resolutionScale: 0.6,
    });
    const zoom = new ZoomBlurEffect();
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(normal);
    composer.addPass(new EffectPass(camera, ink, outline));
    composer.addPass(new EffectPass(camera, zoom));
    return { composer, ink, outline, zoom, selectionKey: '' };
  }, [gl, scene, camera, lowPower]);

  useEffect(() => {
    fx.composer.setSize(size.width, size.height);
    fx.ink.set('uThickness', Math.max(1, 1.5 * dpr));
  }, [fx, size.width, size.height, dpr]);

  useEffect(() => () => fx.composer.dispose(), [fx]);

  useFrame((state, dt) => {
    const s = getState();
    // White outline on the hovered region, or the hovered + pinned holds (spec §6.3, §8.3).
    const keys: string[] = [];
    if (!clock.active) {
      if (s.shown === 'island' && s.hoverRegion) keys.push(`region:${s.hoverRegion}`);
      if (s.shown !== 'island') {
        if (s.hoverItem) keys.push(`hold:${s.hoverItem}`);
        if (s.pinnedItem) keys.push(`hold:${s.pinnedItem}`);
      }
    }
    const key = keys.join('|');
    if (key !== fx.selectionKey) {
      const objs: Object3D[] = [];
      for (const k of keys) objs.push(...(outlineTargets.get(k) ?? []));
      fx.outline.selection.set(objs);
      fx.selectionKey = key;
    }

    fx.zoom.set('uBlur', clock.blur);
    fx.zoom.set('uLines', clock.lines);
    fx.zoom.set('uFlash', clock.flash);
    fx.zoom.set('uTime', state.clock.elapsedTime);
    fx.composer.render(dt);
  }, 1);

  return null;
}

// Island ocean: flat toon water, shallow near the (noisy) island outline, with foam bands rolling
// outward (spec §6.1).
import { Color, ShaderMaterial, UniformsLib, UniformsUtils } from 'three';
import { CHANNEL, ISLAND_R0 } from '../scenes/island/layout';

export function islandWaterMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    fog: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new Color('#1f6fb2') },
        uShallow: { value: new Color('#3fb6e0') },
        uFoam: { value: new Color('#ffffff') },
        uR0: { value: ISLAND_R0 + CHANNEL },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vXZ = wp.xz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform float uR0;
      varying vec2 vXZ;
      #include <fog_pars_fragment>
      void main() {
        float th = atan(vXZ.y, vXZ.x);
        float R = uR0 + 0.8 * sin(3.0 * th + 0.5) + 0.55 * sin(5.0 * th + 1.3) + 0.3 * sin(9.0 * th + 2.1);
        float edge = length(vXZ) - R;
        float shallow = 1.0 - smoothstep(0.2, 5.5, edge);
        vec3 col = mix(uDeep, uShallow, shallow);
        float band = fract(edge * 0.5 - uTime * 0.1);
        float foam = step(0.88, band) * (1.0 - smoothstep(1.0, 6.0, edge)) * step(0.15, edge);
        float rim = (1.0 - smoothstep(0.1, 0.45, abs(edge - 0.25))) * step(-0.3, edge);
        col = mix(col, uFoam, max(foam * 0.8, rim * 0.9));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
  });
}

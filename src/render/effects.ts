// Custom post effects (spec §5, §9): ink outlines from depth + normal edges, and the transition
// zoom blur with speed lines and flash.
import { Effect, EffectAttribute, NormalPass } from 'postprocessing';
import { Color, Uniform, Vector2, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { noInk } from '../state/registry';

const inkFrag = /* glsl */ `
uniform sampler2D uNormals;
uniform float uThickness;
uniform vec3 uInk;
uniform float uDepthThreshold;
uniform float uNormalThreshold;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uStrength;

float invZ(const in vec2 uv) {
  return 1.0 / max(-getViewZ(readDepth(uv)), 1e-4);
}

vec3 nrm(const in vec2 uv) {
  return texture2D(uNormals, uv).xyz * 2.0 - 1.0;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 o = texelSize * uThickness;
  float z0 = max(-getViewZ(depth), 1e-4);
  float w0 = 1.0 / z0;
  float wl = invZ(uv - vec2(o.x, 0.0));
  float wr = invZ(uv + vec2(o.x, 0.0));
  float wd = invZ(uv - vec2(0.0, o.y));
  float wu = invZ(uv + vec2(0.0, o.y));
  // Laplacian of 1/z is ~0 across any plane, so slopes don't produce false lines.
  float lap = (abs(wl + wr - 2.0 * w0) + abs(wu + wd - 2.0 * w0)) / w0;
  float depthEdge = smoothstep(uDepthThreshold, uDepthThreshold * 2.0, lap);

  vec3 n0 = nrm(uv);
  float nd = 1.0 - dot(n0, nrm(uv - vec2(o.x, 0.0)));
  nd = max(nd, 1.0 - dot(n0, nrm(uv + vec2(o.x, 0.0))));
  nd = max(nd, 1.0 - dot(n0, nrm(uv - vec2(0.0, o.y))));
  nd = max(nd, 1.0 - dot(n0, nrm(uv + vec2(0.0, o.y))));
  float normalEdge = smoothstep(uNormalThreshold, uNormalThreshold + 0.2, nd);

  float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, z0);
  float edge = clamp(max(depthEdge, normalEdge) * fade * uStrength, 0.0, 1.0);
  outputColor = vec4(mix(inputColor.rgb, uInk, edge), inputColor.a);
}
`;

export class InkOutlineEffect extends Effect {
  constructor(normals: Texture) {
    super('InkOutlineEffect', inkFrag, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uNormals', new Uniform(normals)],
        ['uThickness', new Uniform(1.5)],
        ['uInk', new Uniform(new Color('#151515'))],
        ['uDepthThreshold', new Uniform(0.035)],
        ['uNormalThreshold', new Uniform(0.4)],
        ['uFadeNear', new Uniform(40)],
        ['uFadeFar', new Uniform(140)],
        ['uStrength', new Uniform(1)],
      ]),
    });
  }

  set(name: string, value: number) {
    this.uniforms.get(name)!.value = value;
  }
}

/** Normal pass that skips particles and glow shells, so they never get ink lines. */
export class InkNormalPass extends NormalPass {
  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget | null,
    outputBuffer: WebGLRenderTarget | null,
    deltaTime?: number,
    stencilTest?: boolean,
  ) {
    const hidden: [{ visible: boolean }, boolean][] = [];
    for (const o of noInk) {
      hidden.push([o, o.visible]);
      o.visible = false;
    }
    super.render(renderer, inputBuffer!, outputBuffer!, deltaTime, stencilTest);
    for (const [o, v] of hidden) o.visible = v;
  }
}

const zoomFrag = /* glsl */ `
uniform float uBlur;
uniform float uLines;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform vec2 uCenter;
uniform float uTime;

float hash(float n) { return fract(sin(n * 91.3458) * 47453.5453); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec4 col = inputColor;
  if (uBlur > 0.001) {
    vec2 dir = uv - uCenter;
    vec4 acc = vec4(0.0);
    for (int i = 0; i < 12; i++) {
      float s = 1.0 - uBlur * 0.22 * float(i) / 11.0;
      acc += texture2D(inputBuffer, uCenter + dir * s);
    }
    col = acc / 12.0;
  }
  if (uLines > 0.001) {
    vec2 d = (uv - uCenter) * vec2(aspect, 1.0);
    float ang = atan(d.y, d.x);
    float r = length(d);
    float cell = floor((ang + 3.14159265) / 6.2831853 * 110.0);
    float h = hash(cell);
    float on = step(0.66, h);
    float streak = fract(r * 1.4 - uTime * (2.2 + h * 2.0) + h * 13.0);
    float band = smoothstep(0.0, 0.12, streak) * (1.0 - smoothstep(0.35, 0.6, streak));
    float mask = on * band * smoothstep(0.22 + h * 0.12, 0.7, r);
    col.rgb = mix(col.rgb, vec3(1.0), clamp(mask * uLines * 0.85, 0.0, 1.0));
  }
  col.rgb = mix(col.rgb, uFlashColor, clamp(uFlash, 0.0, 1.0));
  outputColor = col;
}
`;

export class ZoomBlurEffect extends Effect {
  constructor() {
    super('ZoomBlurEffect', zoomFrag, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uBlur', new Uniform(0)],
        ['uLines', new Uniform(0)],
        ['uFlash', new Uniform(0)],
        ['uFlashColor', new Uniform(new Color('#fff8ec'))],
        ['uCenter', new Uniform(new Vector2(0.5, 0.5))],
        ['uTime', new Uniform(0)],
      ]),
    });
  }

  set(name: 'uBlur' | 'uLines' | 'uFlash' | 'uTime', value: number) {
    this.uniforms.get(name)!.value = value;
  }

  setCenter(x: number, y: number) {
    (this.uniforms.get('uCenter')!.value as Vector2).set(x, y);
  }
}

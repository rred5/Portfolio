/** Deterministic PRNG (mulberry32) so every build of a scene looks the same. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export const range = (r: Rng, min: number, max: number) => min + (max - min) * r();
export const pick = <T,>(r: Rng, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length]!;

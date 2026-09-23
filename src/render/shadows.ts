import { getState } from '../state/store';

/** Shadow map size for a scene's sun: halved on phones and tablets (the cheaper render tier). */
export function shadowMap(size: number): [number, number] {
  const s = getState().env.lowPower ? size / 2 : size;
  return [s, s];
}

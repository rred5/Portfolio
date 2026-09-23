import type { SectionId } from '../content/types';

export type ViewId = 'island' | SectionId;
export type TransitionKind = 'dive' | 'switch' | 'surface' | 'fade';
export type NavVariant = 'rail' | 'dock';
export type InputSource = 'pointer' | 'keyboard';

export interface Transition {
  id: number;
  kind: TransitionKind;
  from: ViewId;
  to: ViewId;
  duration: number;
  swapAt: number;
  firstDive: boolean;
}

export interface Env {
  /** (hover: none) and (pointer: coarse) */
  touch: boolean;
  reduced: boolean;
  /** Bottom-sheet layout (narrow or portrait viewport). */
  sheet: boolean;
  portrait: boolean;
  /** Cheaper rendering tier (touch devices). */
  lowPower: boolean;
  saveData: boolean;
}

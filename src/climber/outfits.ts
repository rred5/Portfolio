// One generic cartoon climber (D8), with an outfit per environment (spec §7).
import type { EnvId } from '../config/sections';

export interface Outfit {
  skin: string;
  hair: string;
  shirt: string;
  sleeves: 'none' | 'short' | 'long' | 'puffy';
  pants: string;
  legs: 'shorts' | 'long';
  shoes: string;
  sole: string;
  /** Harness webbing colour. */
  harness: string;
  chalkBag?: string;
  helmet?: string;
  gloves?: string;
  axes?: boolean;
  crampons?: boolean;
}

const SKIN = '#e8b48a';
const HAIR = '#3b2a20';

export const OUTFITS: Record<EnvId, Outfit> = {
  gym: {
    skin: SKIN,
    hair: HAIR,
    shirt: '#3ee0c5',
    sleeves: 'short',
    pants: '#2b2d42',
    legs: 'shorts',
    shoes: '#ff4fa3',
    sole: '#2b2d42',
    harness: '#ffb400',
    chalkBag: '#6b4eff',
  },
  plains: {
    skin: SKIN,
    hair: HAIR,
    shirt: '#ff7a59',
    sleeves: 'short',
    pants: '#3a5a8c',
    legs: 'long',
    shoes: '#6b4eff',
    sole: '#2b2d42',
    harness: '#2b2d42',
    chalkBag: '#ffd23f',
  },
  glacier: {
    skin: SKIN,
    hair: HAIR,
    shirt: '#ff5a36',
    sleeves: 'puffy',
    pants: '#2b2d42',
    legs: 'long',
    shoes: '#6b4a2e',
    sole: '#8a8f9c',
    harness: '#3a3a48',
    helmet: '#ffd23f',
    gloves: '#3a3a48',
    axes: true,
    crampons: true,
  },
  coast: {
    skin: SKIN,
    hair: HAIR,
    shirt: '#2f9bd6',
    sleeves: 'none',
    pants: '#e8c07a',
    legs: 'shorts',
    shoes: '#ff4fa3',
    sole: '#2b2d42',
    harness: '#ffd23f',
    chalkBag: '#ff5a36',
  },
};

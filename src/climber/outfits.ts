// One generic cartoon climber (D8), with an outfit per environment (spec §7).
import type { EnvId } from '../config/sections';

export interface Outfit {
  skin: string;
  hair: string;
  /** Bun (default) or short hair. */
  hairStyle?: 'bun' | 'short';
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
    shirt: '#1fa7b8',
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

/** The gym's regulars (spec §7.1 background life): no harness, so it matches their trousers. */
export const PEOPLE = {
  boulderer: {
    skin: '#c68642',
    hair: '#1b1b1b',
    hairStyle: 'short',
    shirt: '#ffd23f',
    sleeves: 'none',
    pants: '#3a5a8c',
    legs: 'long',
    shoes: '#35d05a',
    sole: '#2b2d42',
    harness: '#3a5a8c',
    chalkBag: '#ff4fa3',
  },
  watcher: {
    skin: '#f1c9a5',
    hair: '#e0b25a',
    shirt: '#8f5bff',
    sleeves: 'short',
    pants: '#2b2d42',
    legs: 'shorts',
    shoes: '#ff8a3d',
    sole: '#2b2d42',
    harness: '#2b2d42',
  },
  setter: {
    skin: '#8d5a3b',
    hair: '#2b1a12',
    hairStyle: 'short',
    shirt: '#e8423c',
    sleeves: 'long',
    pants: '#6b4a2e',
    legs: 'long',
    shoes: '#f4f1ea',
    sole: '#2b2d42',
    harness: '#6b4a2e',
  },
} satisfies Record<string, Outfit>;

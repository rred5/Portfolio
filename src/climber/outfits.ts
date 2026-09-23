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
    sole: '#151515',
    chalkBag: '#ffb400',
  },
  plains: {
    skin: SKIN,
    hair: HAIR,
    shirt: '#ff7a59',
    sleeves: 'short',
    pants: '#3a5a8c',
    legs: 'long',
    shoes: '#6b4eff',
    sole: '#151515',
    chalkBag: '#ffffff',
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
    sole: '#151515',
    chalkBag: '#151515',
  },
};

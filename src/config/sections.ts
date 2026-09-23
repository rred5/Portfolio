// Presentation data per section (kept out of portfolio.ts so content stays 3D-free).
import type { SectionId } from '../content/types';

export type EnvId = 'gym' | 'glacier' | 'plains' | 'coast';

export const SECTION_IDS: SectionId[] = ['projects', 'experience', 'skills', 'about'];

export const sectionStyle: Record<SectionId, { env: EnvId; accent: string; accentVar: string }> = {
  projects: { env: 'gym', accent: '#ff4fa3', accentVar: 'var(--accent-projects)' },
  experience: { env: 'glacier', accent: '#3e8fd6', accentVar: 'var(--accent-experience)' },
  skills: { env: 'plains', accent: '#58b83c', accentVar: 'var(--accent-skills)' },
  about: { env: 'coast', accent: '#ff8a5b', accentVar: 'var(--accent-about)' },
};

export const isSectionId = (v: string): v is SectionId => (SECTION_IDS as string[]).includes(v);

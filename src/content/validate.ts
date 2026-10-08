// Content validation (spec §4). The build calls assertValidContent, so a bad edit to
// portfolio.ts fails the build instead of shipping a broken wall.

import type { Portfolio, SectionId } from './types';

export const MIN_ITEMS = 2;
export const MAX_ITEMS = 8;
export const MAX_TAG_LENGTH = 18;

const SECTION_IDS: SectionId[] = ['projects', 'experience', 'skills', 'about'];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateContent(p: Portfolio): string[] {
  const errors: string[] = [];

  const sectionIds = new Set(p.sections.map((s) => s.id));
  for (const id of SECTION_IDS) {
    if (!sectionIds.has(id)) errors.push(`Missing section "${id}".`);
  }
  if (p.sections.length !== SECTION_IDS.length) {
    errors.push(`Expected ${SECTION_IDS.length} sections, found ${p.sections.length}.`);
  }

  const seen = new Set<string>();
  for (const item of p.items) {
    if (seen.has(item.id)) errors.push(`Duplicate item id "${item.id}".`);
    seen.add(item.id);
    if (!KEBAB.test(item.id)) errors.push(`Item id "${item.id}" must be kebab-case.`);
    if (!sectionIds.has(item.section)) errors.push(`Item "${item.id}" has unknown section "${item.section}".`);
    if (item.tag.length > MAX_TAG_LENGTH) {
      errors.push(`Item "${item.id}" tag "${item.tag}" is longer than ${MAX_TAG_LENGTH} characters.`);
    }
    if (!item.tag.trim()) errors.push(`Item "${item.id}" needs a tag.`);
  }

  for (const id of SECTION_IDS) {
    const inSection = p.items.filter((i) => i.section === id);
    if (inSection.length < MIN_ITEMS || inSection.length > MAX_ITEMS) {
      errors.push(`Section "${id}" has ${inSection.length} items; each wall holds ${MIN_ITEMS}–${MAX_ITEMS}.`);
    }
    const orders = inSection.map((i) => i.order);
    if (new Set(orders).size !== orders.length) errors.push(`Section "${id}" has duplicate item orders.`);
  }

  return errors;
}

export function assertValidContent(p: Portfolio): void {
  const errors = validateContent(p);
  if (errors.length) throw new Error(`Invalid portfolio content:\n- ${errors.join('\n- ')}`);
}

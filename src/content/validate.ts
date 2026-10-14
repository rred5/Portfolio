// Content validation (spec §4). The build calls assertValidContent, so a bad edit to
// portfolio.ts fails the build instead of shipping a broken wall or card.

import type { DateRange, Item, Link, Portfolio, SectionId } from './types';

export const MIN_ITEMS = 2;
export const MAX_ITEMS = 8;
export const MAX_TAG_LENGTH = 18;

const SECTION_IDS: SectionId[] = ['projects', 'experience', 'skills', 'about'];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** "YYYY" or "YYYY-MM". */
const DATE = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A required text field: present, and no stray spaces at either end. */
function text(where: string, field: string, value: string | undefined, out: string[]): void {
  if (!value || !value.trim()) out.push(`${where}: "${field}" is empty.`);
  else if (value !== value.trim()) out.push(`${where}: "${field}" has spaces at the start or end.`);
}

/** A list of short strings (bullets, chips): none empty, none repeated. */
function list(where: string, field: string, values: string[] | undefined, out: string[]): void {
  const seen = new Set<string>();
  for (const v of values ?? []) {
    if (!v.trim()) out.push(`${where}: "${field}" has an empty entry.`);
    else if (v !== v.trim()) out.push(`${where}: "${field}" entry "${v}" has spaces at the start or end.`);
    if (seen.has(v)) out.push(`${where}: "${field}" lists "${v}" twice.`);
    seen.add(v);
  }
}

function url(where: string, field: string, value: string | undefined, out: string[]): void {
  if (value === undefined) return;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol');
  } catch {
    out.push(`${where}: "${field}" must be a full http(s) URL, got "${value}".`);
  }
}

function link(where: string, field: string, l: Link | undefined, out: string[]): void {
  if (!l) return;
  text(where, `${field} label`, l.label, out);
  url(where, `${field} url`, l.url, out);
}

function dates(where: string, d: DateRange, out: string[]): void {
  if (!DATE.test(d.start)) out.push(`${where}: dates.start "${d.start}" must look like "2025-08" or "2025".`);
  if (d.end !== undefined && !DATE.test(d.end)) out.push(`${where}: dates.end "${d.end}" must look like "2025-08" or "2025".`);
  if (DATE.test(d.start) && d.end && DATE.test(d.end) && d.end < d.start) out.push(`${where}: dates end before they start.`);
  if (d.label !== undefined) text(where, 'dates.label', d.label, out);
}

function itemFields(item: Item, out: string[]): void {
  const where = `Item "${item.id}"`;
  switch (item.kind) {
    case 'project':
      text(where, 'name', item.name, out);
      text(where, 'summary', item.summary, out);
      text(where, 'description', item.description, out);
      list(where, 'tech', item.tech, out);
      list(where, 'highlights', item.highlights, out);
      if (item.dates) dates(where, item.dates, out);
      url(where, 'links.github', item.links?.github, out);
      url(where, 'links.demo', item.links?.demo, out);
      for (const l of item.links?.other ?? []) link(where, 'links.other', l, out);
      if (item.image) {
        text(where, 'image src', item.image.src, out);
        text(where, 'image alt', item.image.alt, out);
      }
      break;
    case 'experience':
      text(where, 'company', item.company, out);
      text(where, 'role', item.role, out);
      text(where, 'summary', item.summary, out);
      list(where, 'bullets', item.bullets, out);
      list(where, 'tech', item.tech, out);
      dates(where, item.dates, out);
      link(where, 'link', item.link, out);
      break;
    case 'skills':
      text(where, 'name', item.name, out);
      if (item.skills.length === 0) out.push(`${where}: "skills" is empty.`);
      list(where, 'skills', item.skills.map((s) => s.name), out);
      break;
    case 'about':
      text(where, 'heading', item.heading, out);
      text(where, 'body', item.body, out);
      list(where, 'bullets', item.bullets, out);
      break;
    case 'contact':
      text(where, 'heading', item.heading, out);
      break;
  }
}

export function validateContent(p: Portfolio): string[] {
  const errors: string[] = [];

  const { profile } = p;
  text('Profile', 'name', profile.name, errors);
  text('Profile', 'title', profile.title, errors);
  text('Profile', 'summary', profile.summary, errors);
  if (!EMAIL.test(profile.email)) errors.push(`Profile: "email" "${profile.email}" is not an email address.`);
  // The Contact card's tel: link adds +1, so the number has to be a 10-digit US number.
  if (profile.phone !== undefined && profile.phone.replace(/\D/g, '').length !== 10) {
    errors.push(`Profile: "phone" "${profile.phone}" must have 10 digits.`);
  }
  for (const l of profile.links) link('Profile', 'links', l, errors);
  if (profile.resumeUrl !== undefined && !/^\/[^\s]+\.pdf$/.test(profile.resumeUrl)) {
    errors.push(`Profile: "resumeUrl" "${profile.resumeUrl}" must be a PDF under /public, like "/resume.pdf".`);
  }

  const sectionIds = new Set(p.sections.map((s) => s.id));
  for (const id of SECTION_IDS) {
    if (!sectionIds.has(id)) errors.push(`Missing section "${id}".`);
  }
  if (p.sections.length !== SECTION_IDS.length) {
    errors.push(`Expected ${SECTION_IDS.length} sections, found ${p.sections.length}.`);
  }
  for (const s of p.sections) {
    text(`Section "${s.id}"`, 'label', s.label, errors);
    text(`Section "${s.id}"`, 'navLabel', s.navLabel, errors);
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
    itemFields(item, errors);
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

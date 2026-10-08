// Markdown generator for the text version (spec §16). One source for /llms-full.txt, /llms.txt and
// the /text page. Dated sections list newest first, which reads better as text; the walls show them
// oldest-first bottom to top.

import type { Item, Portfolio, Profile, Section } from '../../content/types';
import { formatRange } from '../dates';

const DATED = new Set(['projects', 'experience']);

function sectionItems(p: Portfolio, s: Section): Item[] {
  const list = p.items.filter((i) => i.section === s.id).sort((a, b) => a.order - b.order);
  return DATED.has(s.id) ? list.reverse() : list;
}

function orderedSections(p: Portfolio): Section[] {
  return [...p.sections].sort((a, b) => a.order - b.order);
}

function contactLines(profile: Profile): string[] {
  const lines = [`- Email: [${profile.email}](mailto:${profile.email})`];
  if (profile.phone) lines.push(`- Phone: ${profile.phone}`);
  for (const l of profile.links) lines.push(`- ${l.label}: <${l.url}>`);
  if (profile.resumeUrl) lines.push(`- Resume: <${profile.resumeUrl}>`);
  return lines;
}

function itemMarkdown(item: Item, profile: Profile): string {
  const out: string[] = [];
  switch (item.kind) {
    case 'project': {
      out.push(`### ${item.name}`);
      if (item.dates) out.push(`_${formatRange(item.dates)}_`);
      out.push(item.summary, item.description);
      if (item.highlights?.length) out.push(['**Highlights**', ...item.highlights.map((h) => `- ${h}`)].join('\n'));
      if (item.tech.length) out.push(`**Tech:** ${item.tech.join(', ')}`);
      const links: string[] = [];
      if (item.links?.github) links.push(`[GitHub](${item.links.github})`);
      if (item.links?.demo) links.push(`[Demo](${item.links.demo})`);
      for (const l of item.links?.other ?? []) links.push(`[${l.label}](${l.url})`);
      if (links.length) out.push(`**Links:** ${links.join(' · ')}`);
      break;
    }
    case 'experience': {
      out.push(`### ${item.role} · ${item.company}`);
      out.push(`_${[formatRange(item.dates), item.location].filter(Boolean).join(' · ')}_`);
      out.push(item.summary);
      if (item.bullets.length) out.push(item.bullets.map((b) => `- ${b}`).join('\n'));
      if (item.tech?.length) out.push(`**Tech:** ${item.tech.join(', ')}`);
      if (item.link) out.push(`**Link:** [${item.link.label}](${item.link.url})`);
      break;
    }
    case 'skills': {
      out.push(`### ${item.name}`);
      out.push(item.skills.map((s) => `- ${s.name}${s.level ? ` (${s.level})` : ''}`).join('\n'));
      if (item.note) out.push(item.note);
      break;
    }
    case 'about': {
      out.push(`### ${item.heading}`);
      out.push(item.body);
      break;
    }
    case 'contact': {
      out.push(`### ${item.heading}`);
      out.push(contactLines(profile).join('\n'));
      break;
    }
  }
  return out.join('\n\n');
}

/** The whole portfolio as one Markdown document (/llms-full.txt and /text). */
export function fullMarkdown(p: Portfolio): string {
  const { profile } = p;
  const parts: string[] = [
    `# ${profile.name}`,
    `> ${profile.title}. ${profile.summary}`,
    [profile.location ? `Location: ${profile.location}` : '', ...contactLines(profile)].filter(Boolean).join('\n'),
  ];
  for (const s of orderedSections(p)) {
    parts.push(`## ${s.label}`);
    if (s.intro) parts.push(s.intro);
    for (const item of sectionItems(p, s)) parts.push(itemMarkdown(item, profile));
  }
  return parts.join('\n\n') + '\n';
}

function sectionBlurb(p: Portfolio, s: Section): string {
  const names = sectionItems(p, s).map((i) => i.tag);
  return `${names.length} ${names.length === 1 ? 'entry' : 'entries'}: ${names.join(', ')}`;
}

/** llmstxt.org-format index (/llms.txt). */
export function llmsTxt(p: Portfolio, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '');
  const { profile } = p;
  const lines = [
    `# ${profile.name}`,
    '',
    `> ${profile.title}. ${profile.summary}`,
    '',
    `This is the text index of ${profile.name}'s developer portfolio. The main site is an interactive 3D climbing island; everything on it is also available as plain Markdown below.`,
    '',
    '## Sections',
    '',
    ...orderedSections(p).map((s) => `- [${s.label}](${base}/text#${s.id}): ${sectionBlurb(p, s)}`),
    '',
    '## Optional',
    '',
    `- [Full portfolio as Markdown](${base}/llms-full.txt): every project, job, skill and contact detail in one file`,
    '',
  ];
  return lines.join('\n');
}

/** Maps a section heading back to its id, for anchors on the /text page. */
export function sectionIdForHeading(p: Portfolio, heading: string): string | undefined {
  return p.sections.find((s) => s.label === heading)?.id;
}

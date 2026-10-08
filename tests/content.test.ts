import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { portfolio } from '../src/content/portfolio';
import type { Item } from '../src/content/types';
import { validateContent } from '../src/content/validate';
import { fullMarkdown, llmsTxt } from '../src/lib/text/markdown';
import { formatMonth, formatRange } from '../src/lib/dates';

// These tests read the content from portfolio.ts instead of naming specific items, so editing the
// content (adding a project, dropping CAMP, removing the phone number) does not break them.

const ofKind = <K extends Item['kind']>(kind: K) => portfolio.items.filter((i): i is Extract<Item, { kind: K }> => i.kind === kind);
const inSection = (section: string) => portfolio.items.filter((i) => i.section === section).sort((a, b) => a.order - b.order);

describe('content', () => {
  it('content is valid', () => {
    expect(validateContent(portfolio)).toEqual([]);
  });

  it('catches duplicate ids, long tags and wall sizes', () => {
    const broken = structuredClone(portfolio);
    broken.items[1]!.id = broken.items[0]!.id;
    broken.items[2]!.tag = 'A tag that is far too long';
    broken.items = broken.items.filter((i) => i.section !== 'about' || i.order === 0);
    const errors = validateContent(broken);
    expect(errors.some((e) => e.includes('Duplicate item id'))).toBe(true);
    expect(errors.some((e) => e.includes('longer than 18'))).toBe(true);
    expect(errors.some((e) => e.includes('Section "about" has 1 items'))).toBe(true);
  });

  it('stays valid with CAMP dropped from the Experience wall', () => {
    const noCamp = structuredClone(portfolio);
    noCamp.items = noCamp.items.filter((i) => i.id !== 'camp');
    expect(validateContent(noCamp)).toEqual([]);
  });

  it('catches empty text, bad dates, bad links and repeated entries', () => {
    const broken = structuredClone(portfolio);
    const project = broken.items.find((i) => i.kind === 'project');
    const job = broken.items.find((i) => i.kind === 'experience');
    const about = broken.items.find((i) => i.kind === 'about');
    if (project?.kind !== 'project' || job?.kind !== 'experience' || about?.kind !== 'about') throw new Error('needs a project, an experience and an about item');
    project.summary = '  ';
    project.highlights = ['Same', 'Same'];
    project.links = { demo: 'company-brain.example' };
    job.dates = { start: '2025-13' };
    about.bullets = ['Top 30', ''];
    broken.profile.phone = '555-1234';
    broken.profile.email = 'not-an-email';
    broken.profile.resumeUrl = 'resume.pdf';

    const errors = validateContent(broken);
    const has = (s: string) => expect(errors.some((e) => e.includes(s)), `expected an error containing: ${s}\n${errors.join('\n')}`).toBe(true);
    has('"summary" is empty');
    has('lists "Same" twice');
    has('"links.demo" must be a full http(s) URL');
    has('dates.start "2025-13"');
    has('"bullets" has an empty entry');
    has('"phone" "555-1234" must have 10 digits');
    has('is not an email address');
    has('"resumeUrl"');
  });

  it('catches dates that end before they start', () => {
    const broken = structuredClone(portfolio);
    const job = broken.items.find((i) => i.kind === 'experience');
    if (job?.kind !== 'experience') throw new Error('needs an experience item');
    job.dates = { start: '2029-05', end: '2025-08' };
    expect(validateContent(broken).some((e) => e.includes('end before they start'))).toBe(true);
  });

  it('has a resume PDF in /public for both CAMP settings', () => {
    expect(existsSync('public/resume-with-camp.pdf')).toBe(true);
    expect(existsSync('public/resume-no-camp.pdf')).toBe(true);
    expect(existsSync(`public${portfolio.profile.resumeUrl}`)).toBe(true);
  });
});

// A hover preview cannot scroll (D22), so card text has to stay short enough to show in full on a laptop
// screen. These limits are measured against the 1280×720 hover previews; raise them if you shorten the
// card elsewhere (fewer chips, no links), and re-check the longest cards in the browser.
describe('card text length', () => {
  it('keeps each project card short enough to read without scrolling', () => {
    for (const p of ofKind('project')) {
      expect(p.summary.length, `${p.id} summary`).toBeLessThanOrEqual(70);
      expect(p.description.length, `${p.id} description`).toBeLessThanOrEqual(240);
      expect(p.description.includes('\n'), `${p.id} description should be one paragraph`).toBe(false);
      expect(p.highlights?.length ?? 0, `${p.id} highlight count`).toBeLessThanOrEqual(3);
      for (const h of p.highlights ?? []) expect(h.length, `${p.id} highlight "${h}"`).toBeLessThanOrEqual(125);
      expect(p.tech.length, `${p.id} tech chips`).toBeLessThanOrEqual(7);
    }
  });

  it('keeps the other cards short too', () => {
    for (const i of ofKind('experience')) {
      expect(i.summary.length, `${i.id} summary`).toBeLessThanOrEqual(80);
      expect(i.bullets.length, `${i.id} bullets`).toBeLessThanOrEqual(3);
    }
    for (const i of ofKind('about')) expect(i.body.length, `${i.id} body`).toBeLessThanOrEqual(420);
  });
});

describe('dates', () => {
  it('formats months, years and open ranges', () => {
    expect(formatMonth('2024-03')).toBe('Mar 2024');
    expect(formatRange({ start: '2025-07' })).toBe('Jul 2025 – Present');
    expect(formatRange({ start: '2022', end: '2024' })).toBe('2022 – 2024');
  });

  it('shows a label instead of the range when there is one', () => {
    expect(formatRange({ start: '2025', label: 'Summer 2025' })).toBe('Summer 2025');
  });
});

describe('text version', () => {
  const md = fullMarkdown(portfolio);
  const heading = (i: Item) => {
    switch (i.kind) {
      case 'project':
      case 'skills':
        return `### ${i.name}`;
      case 'experience':
        return `### ${i.role} · ${i.company}`;
      case 'about':
      case 'contact':
        return `### ${i.heading}`;
    }
  };

  it('has every section in order, with every item', () => {
    const headings = md.split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toEqual(portfolio.sections.slice().sort((a, b) => a.order - b.order).map((s) => `## ${s.label}`));
    for (const item of portfolio.items) expect(md, item.id).toContain(heading(item));
    expect(md).not.toContain('[Placeholder]');
  });

  it('has the contact details and the lists', () => {
    const { profile } = portfolio;
    expect(md).toContain(`[${profile.email}](mailto:${profile.email})`);
    if (profile.phone) expect(md).toContain(`- Phone: ${profile.phone}`);
    else expect(md).not.toContain('- Phone:');
    for (const l of profile.links) expect(md).toContain(`- ${l.label}: <${l.url}>`);
    for (const i of ofKind('about')) for (const b of i.bullets ?? []) expect(md).toContain(`- ${b}`);
    for (const i of ofKind('skills')) for (const s of i.skills) expect(md).toContain(`- ${s.name}`);
  });

  it('lists dated sections newest first', () => {
    for (const section of ['projects', 'experience']) {
      const positions = inSection(section).reverse().map((i) => md.indexOf(heading(i)));
      expect(positions, section).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  it('llms.txt follows the llmstxt.org shape', () => {
    const txt = llmsTxt(portfolio, 'https://site.example/');
    const lines = txt.split('\n');
    expect(lines[0]).toBe(`# ${portfolio.profile.name}`);
    expect(lines[2]!.startsWith('> ')).toBe(true);
    expect(txt).toContain('## Sections');
    const n = inSection('projects').length;
    expect(txt).toContain(`- [Projects](https://site.example/text#projects): ${n} ${n === 1 ? 'entry' : 'entries'}`);
    expect(txt).toContain('## Optional');
    expect(txt).toContain('(https://site.example/llms-full.txt)');
  });
});

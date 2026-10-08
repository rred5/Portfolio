import { describe, expect, it } from 'vitest';
import { portfolio } from '../src/content/portfolio';
import { validateContent } from '../src/content/validate';
import { fullMarkdown, llmsTxt } from '../src/lib/text/markdown';
import { formatMonth, formatRange } from '../src/lib/dates';

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

  it('has every section in order, with every item', () => {
    const headings = md.split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toEqual(['## Projects', '## Experience', '## Skills', '## About & Contact']);
    expect(md).toContain('### PhoneBench');
    expect(md).toContain('### B.S. in Computer Science · Purdue University');
    expect(md).toContain('- TypeScript');
    expect(md).toContain('[ryangreddy@gmail.com](mailto:ryangreddy@gmail.com)');
    expect(md).toContain('- Phone: 512-766-9833');
    expect(md).not.toContain('[Placeholder]');
  });

  it('lists dated sections newest first', () => {
    expect(md.indexOf('### PhoneBench')).toBeLessThan(md.indexOf('### Robot Tour'));
  });

  it('llms.txt follows the llmstxt.org shape', () => {
    const txt = llmsTxt(portfolio, 'https://site.example/');
    const lines = txt.split('\n');
    expect(lines[0]).toBe('# Ryan Reddy');
    expect(lines[2]!.startsWith('> ')).toBe(true);
    expect(txt).toContain('## Sections');
    expect(txt).toContain('- [Projects](https://site.example/text#projects): 4 entries');
    expect(txt).toContain('## Optional');
    expect(txt).toContain('(https://site.example/llms-full.txt)');
  });
});

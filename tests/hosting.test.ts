import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sections } from '../src/content/portfolio';

// The build emits `projects.html`, `text.html`, ... (astro.config.mjs: build.format = 'file'). Vercel only
// serves `/projects` from `projects.html` when cleanUrls is on; without it every section URL and /text 404s.
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('hosting', () => {
  it('builds one .html file per page, so the host must map clean URLs', () => {
    expect(read('astro.config.mjs')).toMatch(/format:\s*'file'/);
    expect(sections.length).toBeGreaterThan(0);
  });

  it('vercel.json serves /projects and /text from projects.html and text.html', () => {
    const config = JSON.parse(read('vercel.json'));
    expect(config.cleanUrls).toBe(true);
    // Astro is configured with trailingSlash: 'never', so /text/ should redirect to /text.
    expect(config.trailingSlash).toBe(false);
  });
});

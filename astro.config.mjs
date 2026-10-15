// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// SITE_URL is only used for absolute links in /llms.txt. Set it once hosting is decided (spec D10).
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://your-domain.example',
  integrations: [react()],
  // `/projects` → projects.html. The host must map clean URLs to those files: Vercel needs
  // `cleanUrls: true` (vercel.json; without it /text and every section URL 404). Netlify and GitHub Pages do it by default.
  build: { format: 'file' },
  trailingSlash: 'never',
  devToolbar: { enabled: false },
});

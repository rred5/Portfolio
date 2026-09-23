// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// SITE_URL is only used for absolute links in /llms.txt. Set it once hosting is decided (spec D10).
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://your-domain.example',
  integrations: [react()],
  // `/projects` → projects.html, so section URLs work on any static host without rewrites.
  build: { format: 'file' },
  trailingSlash: 'never',
  devToolbar: { enabled: false },
});

import type { APIRoute } from 'astro';
import { portfolio } from '../content/portfolio';
import { assertValidContent } from '../content/validate';
import { llmsTxt } from '../lib/text/markdown';

export const GET: APIRoute = ({ site }) => {
  assertValidContent(portfolio);
  return new Response(llmsTxt(portfolio, site?.toString() ?? ''), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};

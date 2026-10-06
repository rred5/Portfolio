import type { APIRoute } from 'astro';
import { portfolio } from '../content/portfolio';
import { assertValidContent } from '../content/validate';
import { fullMarkdown } from '../lib/text/markdown';

export const GET: APIRoute = () => {
  assertValidContent(portfolio);
  return new Response(fullMarkdown(portfolio), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};

import type { DateRange } from '../content/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2024-03" → "Mar 2024". A bare year ("2024") and anything unparseable are returned as-is. */
export function formatMonth(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : ym;
}

export function formatRange(r: DateRange): string {
  if (r.label) return r.label;
  return `${formatMonth(r.start)} – ${r.end ? formatMonth(r.end) : 'Present'}`;
}

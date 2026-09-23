import { items, profile, sections } from './portfolio';
import type { Item, SectionId } from './types';

export { items, profile, sections };

export const sectionsInOrder = [...sections].sort((a, b) => a.order - b.order);

/** Items of a section, bottom (order 0) to top. */
export function itemsFor(section: SectionId): Item[] {
  return items.filter((i) => i.section === section).sort((a, b) => a.order - b.order);
}

export function itemById(id: string): Item | undefined {
  return items.find((i) => i.id === id);
}

export function sectionById(id: SectionId) {
  const s = sections.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown section ${id}`);
  return s;
}

/** Card / text title for any item. */
export function itemTitle(item: Item): string {
  switch (item.kind) {
    case 'project':
      return item.name;
    case 'experience':
      return item.role;
    case 'skills':
      return item.name;
    case 'about':
    case 'contact':
      return item.heading;
  }
}

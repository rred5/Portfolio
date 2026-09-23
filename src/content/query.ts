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

/** The items just below and above this one on its wall. */
export function siblings(item: Item): { prev?: Item; next?: Item } {
  const list = itemsFor(item.section);
  const i = list.findIndex((x) => x.id === item.id);
  return { prev: list[i - 1], next: list[i + 1] };
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

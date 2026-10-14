// Portfolio content types (spec §4). Nothing in here knows about 3D: scenes, cards and the text
// version all read the same data.

export interface Link {
  label: string;
  url: string;
}

export interface DateRange {
  /** "YYYY-MM", or just "YYYY" when the month isn't known. */
  start: string;
  /** Same format; missing means "Present". */
  end?: string;
  /** Shown instead of the formatted range, e.g. "Summer 2025". */
  label?: string;
}

export interface Profile {
  name: string;
  title: string;
  /** 1–2 sentences, used in llms.txt and the About section. */
  summary: string;
  location?: string;
  email: string;
  /** Shown on the Contact card and in the text version when set. */
  phone?: string;
  links: Link[];
  /** PDF under /public, e.g. "/resume.pdf". */
  resumeUrl?: string;
}

export type SectionId = 'projects' | 'experience' | 'skills' | 'about';

export interface Section {
  id: SectionId;
  /** Island label and section title: "Projects". */
  label: string;
  /** Short nav label (fits a 72px rail button). */
  navLabel: string;
  /** Island label order, nav order, text-version order. */
  order: number;
  /** Text version only. */
  intro?: string;
}

interface BaseItem {
  /** URL hash and hold binding; kebab-case, unique. */
  id: string;
  section: SectionId;
  /** Route order: 0 = lowest hold on the wall (oldest for dated items). */
  order: number;
  /** Short hold name tag, at most 18 characters. */
  tag: string;
}

export interface Image {
  src: string;
  alt: string;
}

export interface ProjectItem extends BaseItem {
  kind: 'project';
  name: string;
  dates?: DateRange;
  summary: string;
  description: string;
  tech: string[];
  highlights?: string[];
  image?: Image;
  links?: { github?: string; demo?: string; other?: Link[] };
}

export interface ExperienceItem extends BaseItem {
  kind: 'experience';
  company: string;
  role: string;
  dates: DateRange;
  location?: string;
  summary: string;
  bullets: string[];
  tech?: string[];
  link?: Link;
}

export type SkillLevel = 'familiar' | 'proficient' | 'expert';

export interface SkillGroupItem extends BaseItem {
  kind: 'skills';
  name: string;
  skills: { name: string; level?: SkillLevel }[];
  note?: string;
}

export interface AboutItem extends BaseItem {
  kind: 'about';
  heading: string;
  body: string;
  /** Shown as a list under the body. */
  bullets?: string[];
  image?: Image;
}

/** Renders Profile.email, Profile.links and Profile.resumeUrl. */
export interface ContactItem extends BaseItem {
  kind: 'contact';
  heading: string;
}

export type Item = ProjectItem | ExperienceItem | SkillGroupItem | AboutItem | ContactItem;

export interface Portfolio {
  profile: Profile;
  sections: Section[];
  items: Item[];
}

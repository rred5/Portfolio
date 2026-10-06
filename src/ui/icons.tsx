// Small inline icons in the site's ink style. All decorative (aria-hidden); buttons carry labels.
import type { SectionId } from '../content/types';

const common = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function IslandIcon() {
  return (
    <svg {...common}>
      <path d="M3 17c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0" />
      <path d="M5 14l4-6 3 4 2-2 5 4" />
    </svg>
  );
}

export function BoardIcon() {
  return (
    <svg {...common}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" />
      <circle cx="12" cy="13" r="1.2" fill="currentColor" />
      <circle cx="8" cy="16" r="1.2" fill="currentColor" />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function MountainIcon() {
  return (
    <svg {...common}>
      <path d="M3 19l6-11 4 6 2-3 6 8z" />
      <path d="M9 8l1.6 3-1.6 1.2-1.6-1.2z" />
    </svg>
  );
}

export function BoulderIcon() {
  return (
    <svg {...common}>
      <circle cx="17.5" cy="6.5" r="2.5" />
      <path d="M3 19c0-5 3-9 7-9s7 3 8 9z" />
      <path d="M8 15h5" />
    </svg>
  );
}

export function WaveIcon() {
  return (
    <svg {...common}>
      <path d="M4 20V9l4-4 3 3v12" />
      <path d="M13 17c1.5 1 3 1 4.5 0s3-1 4.5 0" />
      <path d="M13 13c1.5 1 3 1 4.5 0s3-1 4.5 0" />
    </svg>
  );
}

export const SECTION_ICON: Record<SectionId, () => React.JSX.Element> = {
  projects: BoardIcon,
  experience: MountainIcon,
  skills: BoulderIcon,
  about: WaveIcon,
};

export function CloseIcon() {
  return (
    <svg {...common} strokeWidth={3}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg {...common} width={14} height={14} strokeWidth={2.6}>
      <path d="M9 3h6l-1 6 3 3H7l3-3z" fill="currentColor" />
      <path d="M12 12v8" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg {...common} width={18} height={18}>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </svg>
  );
}

export function CodeIcon() {
  return (
    <svg {...common} width={18} height={18}>
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg {...common} width={18} height={18}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg {...common} width={16} height={16}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg {...common} width={18} height={18}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}

export function TextIcon() {
  return (
    <svg {...common} width={18} height={18}>
      <path d="M5 6h14M5 11h14M5 16h9" />
    </svg>
  );
}

// Section navigation (spec §12): two variants built for comparison, chosen with ?nav=rail|dock (P10).
// Phones always get the dock (spec §12.3). Hidden on the island (the island is the navigation).
import { sectionStyle } from '../config/sections';
import { sectionsInOrder } from '../content/query';
import { useStore } from '../state/store';
import { IslandIcon, SECTION_ICON } from './icons';

export function Nav() {
  const shown = useStore((s) => s.shown);
  const view = useStore((s) => s.view);
  const variant = useStore((s) => s.navVariant);
  const sheet = useStore((s) => s.env.sheet);
  const sheetOpen = useStore((s) => s.env.sheet && !!s.pinnedItem);
  const navigate = useStore((s) => s.navigate);
  if (shown === 'island') return null;

  const kind = sheet ? 'dock' : variant;
  const current = view;
  return (
    <nav className={`nav nav--${kind}`} aria-label="Sections" data-hidden={sheetOpen ? '1' : '0'}>
      <ul className="nav__list">
        <li className="nav__home">
          <a
            className="nav-btn"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('island');
            }}
          >
            <IslandIcon />
            <span className="nav-btn__label">Island</span>
          </a>
        </li>
        {sectionsInOrder.map((sec, i) => {
          const Icon = SECTION_ICON[sec.id];
          const active = current === sec.id;
          return (
            <li key={sec.id}>
              <a
                className="nav-btn"
                href={`/${sec.id}`}
                aria-current={active ? 'page' : undefined}
                aria-keyshortcuts={String(i + 1)}
                style={{ '--accent': sectionStyle[sec.id].accent } as React.CSSProperties}
                onClick={(e) => {
                  e.preventDefault();
                  if (!active) navigate(sec.id);
                }}
              >
                <Icon />
                <span className="nav-btn__label">{sec.navLabel}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Island title (D20) and the section top bar (D21): name top-left (→ island), section title
// top-middle over the wall area, "Text version" top-right on every 3D screen (D16).
import { profile, sectionById } from '../content/query';
import { useStore } from '../state/store';
import { TextIcon } from './icons';

export function IslandTitle() {
  const shown = useStore((s) => s.shown);
  const active = useStore((s) => !!s.transition);
  return (
    <header className="island-title" data-hidden={shown !== 'island' || active ? '1' : '0'}>
      <h1 className="island-title__name">{profile.name}</h1>
      <p className="island-title__sub">{profile.title}</p>
    </header>
  );
}

export function TopBar() {
  const shown = useStore((s) => s.shown);
  const navigate = useStore((s) => s.navigate);
  const phone = useStore((s) => s.env.sheet);
  const inSection = shown !== 'island';
  return (
    <div className="topbar">
      {inSection && (
        <>
          <a
            className="topbar__name"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('island');
            }}
            aria-label={`${profile.name}: back to the island`}
          >
            {profile.name}
          </a>
          {/* The phone top bar is too narrow for "About & Contact", so it uses the short nav label. */}
          <h1 className="topbar__title">{phone ? sectionById(shown).navLabel : sectionById(shown).label}</h1>
        </>
      )}
      <a className="text-btn" href="/text">
        <TextIcon />
        <span>Text version</span>
      </a>
    </div>
  );
}

// DOM layer over the canvas. The container ignores the pointer; its controls opt back in.
import { useStore } from '../state/store';
import { CardHost } from './Card';
import { HoldTags } from './HoldTags';
import { LoadingScreen, TransitionSpinner } from './Loading';
import { Nav } from './Nav';
import { RegionLabels } from './RegionLabels';
import { IslandTitle, TopBar } from './TopBar';

export function Overlay() {
  const shown = useStore((s) => s.shown);
  const sheet = useStore((s) => s.env.sheet);
  const nav = useStore((s) => s.navVariant);
  const reduced = useStore((s) => s.env.reduced);
  return (
    <div
      className="overlay"
      data-view={shown === 'island' ? 'island' : 'section'}
      data-layout={sheet ? 'sheet' : 'column'}
      data-nav={sheet ? 'dock' : nav}
      data-reduced={reduced ? '1' : '0'}
    >
      <IslandTitle />
      <TopBar />
      <RegionLabels />
      <HoldTags />
      <Nav />
      <CardHost />
      <TransitionSpinner />
      <LoadingScreen />
    </div>
  );
}

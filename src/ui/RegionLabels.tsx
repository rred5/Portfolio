// Island region labels (spec §6.2): real buttons. Hover/focus = region hover, click = enter.
import { sectionsInOrder } from '../content/query';
import { regionLabelPos } from '../scenes/island/Island';
import { useStore } from '../state/store';
import { Anchored } from './Anchored';

export function RegionLabels() {
  const hoverRegion = useStore((s) => s.hoverRegion);
  const setHoverRegion = useStore((s) => s.setHoverRegion);
  const navigate = useStore((s) => s.navigate);
  const request = useStore((s) => s.request);
  return (
    <nav className="region-labels" aria-label="Portfolio sections">
      {sectionsInOrder.map((sec) => (
        <Anchored key={sec.id} view="island" pos={regionLabelPos[sec.id]} className="anchor--label">
          <button
            type="button"
            className="region-label"
            data-hover={hoverRegion === sec.id ? '1' : '0'}
            aria-label={`Enter ${sec.label}`}
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
                setHoverRegion(sec.id);
                request(sec.id);
              }
            }}
            onPointerLeave={(e) => {
              if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && useStore.getState().hoverRegion === sec.id) setHoverRegion(null);
            }}
            onFocus={() => setHoverRegion(sec.id)}
            onBlur={() => {
              if (useStore.getState().hoverRegion === sec.id) setHoverRegion(null);
            }}
            onClick={() => navigate(sec.id)}
          >
            {sec.label}
          </button>
        </Anchored>
      ))}
    </nav>
  );
}

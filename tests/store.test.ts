import { beforeEach, describe, expect, it } from 'vitest';
import { motion } from '../src/config/motion';
import { itemsFor } from '../src/content/query';
import { useStore } from '../src/state/store';

const s = () => useStore.getState();

// Item ids come from portfolio.ts, so editing the content does not break these tests.
const projectIds = itemsFor('projects').map((i) => i.id);
const first = projectIds[0]!;
const second = projectIds[1]!;
const last = projectIds[projectIds.length - 1]!;
const skillId = itemsFor('skills')[0]!.id;

beforeEach(() => {
  useStore.setState({
    view: 'island',
    shown: 'island',
    transition: null,
    hasDived: false,
    pinnedItem: null,
    hoverItem: null,
    climberItem: {},
    requested: {},
    env: { touch: false, reduced: false, sheet: false, portrait: false, lowPower: false, saveData: false },
  });
});

function finish() {
  s().swap();
  s().endTransition();
}

describe('navigation', () => {
  it('first dive is the long one, later dives are short', () => {
    s().navigate('projects', { history: 'none' });
    expect(s().transition).toMatchObject({ kind: 'dive', duration: motion.diveFirst, firstDive: true });
    finish();
    s().navigate('island', { history: 'none' });
    expect(s().transition?.kind).toBe('surface');
    finish();
    s().navigate('skills', { history: 'none' });
    expect(s().transition).toMatchObject({ kind: 'dive', duration: motion.dive, firstDive: false });
  });

  it('section to section is a switch and closes the pinned card', () => {
    s().navigate('projects', { history: 'none' });
    finish();
    s().pin(first, 'pointer');
    expect(s().pinnedItem).toBe(first);
    s().navigate('experience', { history: 'none' });
    expect(s().transition?.kind).toBe('switch');
    expect(s().pinnedItem).toBeNull();
  });

  it('a request mid-transition finishes the current one and heads to the latest target', () => {
    s().navigate('projects', { history: 'none' });
    s().navigate('skills', { history: 'none' });
    expect(s().shown).toBe('projects');
    expect(s().transition).toMatchObject({ kind: 'switch', to: 'skills' });
  });

  it('reduced motion uses the crossfade', () => {
    s().setEnv({ reduced: true });
    s().navigate('about', { history: 'none' });
    expect(s().transition).toMatchObject({ kind: 'fade', duration: motion.reducedFade });
  });
});

describe('holds and cards', () => {
  beforeEach(() => {
    s().navigate('projects', { history: 'none' });
    finish();
  });

  it('hover moves the climber and the climber stays after hover ends', () => {
    s().setHoverItem(second);
    expect(s().climberItem.projects).toBe(second);
    s().setHoverItem(null);
    expect(s().climberItem.projects).toBe(second);
  });

  it('pinned card stays while hovering another hold; clicking another hold replaces it', () => {
    s().pin(first, 'pointer');
    s().setHoverItem(last);
    expect(s().pinnedItem).toBe(first);
    expect(s().climberItem.projects).toBe(last);
    s().pin(last, 'pointer');
    expect(s().pinnedItem).toBe(last);
  });

  it('ignores items from other sections', () => {
    s().pin(skillId, 'pointer');
    expect(s().pinnedItem).toBeNull();
  });

  it('close clears the pinned card', () => {
    s().pin(first, 'keyboard');
    s().closeCard();
    expect(s().pinnedItem).toBeNull();
  });
});

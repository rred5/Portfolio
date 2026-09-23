import { beforeEach, describe, expect, it } from 'vitest';
import { motion } from '../src/config/motion';
import { useStore } from '../src/state/store';

const s = () => useStore.getState();

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
    s().pin('project-a', 'pointer');
    expect(s().pinnedItem).toBe('project-a');
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
    s().setHoverItem('project-b');
    expect(s().climberItem.projects).toBe('project-b');
    s().setHoverItem(null);
    expect(s().climberItem.projects).toBe('project-b');
  });

  it('pinned card stays while hovering another hold; clicking another hold replaces it', () => {
    s().pin('project-a', 'pointer');
    s().setHoverItem('project-c');
    expect(s().pinnedItem).toBe('project-a');
    expect(s().climberItem.projects).toBe('project-c');
    s().pin('project-d', 'pointer');
    expect(s().pinnedItem).toBe('project-d');
  });

  it('ignores items from other sections', () => {
    s().pin('languages', 'pointer');
    expect(s().pinnedItem).toBeNull();
  });

  it('close clears the pinned card', () => {
    s().pin('project-a', 'keyboard');
    s().closeCard();
    expect(s().pinnedItem).toBeNull();
  });
});

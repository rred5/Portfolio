import { describe, expect, it } from 'vitest';
import { copyPose, emptyFrame, evalStep, LIMBS, planSteps, type Flavor } from '../src/climber/moves';
import { wallLayout } from '../src/scenes/layouts';

const timing = { move: 1.2, through: 0.85, reduced: 0.08 };

describe('climbing moves', () => {
  const { route } = wallLayout('projects');
  const n = route.poses.length;

  it('climbs one hold at a time, with the full duration only on the last move', () => {
    const steps = planSteps(route, -1, n - 1, timing, false);
    expect(steps.map((s) => s.index)).toEqual([...Array(n).keys()]);
    expect(steps.filter((s) => s.final)).toHaveLength(1);
    expect(steps.at(-1)!.dur).toBe(1.2);
    expect(steps[0]!.dur).toBe(0.85);
  });

  it('climbs back down through the holds to the rest pose', () => {
    expect(planSteps(route, 2, -1, timing, false).map((s) => s.index)).toEqual([1, 0, -1]);
  });

  it('goes straight to the target under reduced motion', () => {
    const steps = planSteps(route, -1, n - 1, timing, true);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.dur).toBe(0.08);
  });

  for (const flavor of ['rock', 'overhang', 'ice'] as Flavor[]) {
    it(`${flavor}: a step starts at the old pose and ends exactly on the new one`, () => {
      const base = copyPose(route.poses[1]!);
      const [step] = planSteps(route, 1, 2, timing, false);
      const frame = emptyFrame(base);
      evalStep(base, step!, 0, flavor, frame);
      for (const l of LIMBS) expect(frame.pose[l]).toEqual(base[l]);
      evalStep(base, step!, 1, flavor, frame);
      for (const l of LIMBS) {
        expect(frame.pose[l].u).toBeCloseTo(step!.to[l].u, 6);
        expect(frame.pose[l].v).toBeCloseTo(step!.to[l].v, 6);
        expect(frame.arc[l]).toBeCloseTo(0, 6);
      }
      expect(frame.pose.pelvis.v).toBeCloseTo(step!.to.pelvis.v, 6);
      expect(frame.hipIn).toBeCloseTo(0, 6);
    });
  }

  it('keeps both hands on their holds while the body drives up (the pull)', () => {
    const base = copyPose(route.poses[0]!);
    const [step] = planSteps(route, 0, 1, timing, false);
    const frame = emptyFrame(base);
    evalStep(base, step!, 0.4, 'rock', frame);
    expect(frame.pose.lh).toEqual(base.lh);
    expect(frame.pose.rh).toEqual(base.rh);
    expect(frame.pose.pelvis.v).toBeGreaterThan(base.pelvis.v - 0.05);
  });
});

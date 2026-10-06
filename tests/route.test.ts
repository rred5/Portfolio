import { describe, expect, it } from 'vitest';
import { SECTION_IDS } from '../src/config/sections';
import { wallLayout } from '../src/scenes/layouts';
import { BODY, buildRoute, type Pose, type Spot } from '../src/scenes/wall/route';
import { WALLS } from '../src/scenes/walls';

const reachable = (p: Pose, hand: Spot, off: number) => {
  // Shoulder sits torso-length above the pelvis; the arm must be able to reach the hand spot.
  const shoulder = { u: p.pelvis.u, v: p.pelvis.v + BODY.torso };
  const d = Math.hypot(hand.u - shoulder.u, hand.v + off - shoulder.v);
  return d <= BODY.upperArm + BODY.forearm + BODY.shoulderHalf + 0.12;
};

describe('routes and poses', () => {
  for (const id of SECTION_IDS) {
    it(`${id}: one slot and pose per item, bottom to top, all reachable`, () => {
      const { route, items, def } = wallLayout(id);
      expect(route.slots).toHaveLength(items.length);
      expect(route.poses).toHaveLength(items.length);
      for (let i = 1; i < route.slots.length; i++) expect(route.slots[i]!.v).toBeGreaterThan(route.slots[i - 1]!.v);
      route.poses.forEach((p, i) => {
        const hand = p.reach === 'L' ? p.lh : p.rh;
        expect(hand).toMatchObject({ u: route.slots[i]!.u, v: route.slots[i]!.v });
        expect(reachable(p, p.lh, def.handOffsetV)).toBe(true);
        expect(reachable(p, p.rh, def.handOffsetV)).toBe(true);
      });
    });
  }

  it('handles every wall size from 3 to 8 items', () => {
    for (const def of Object.values(WALLS)) {
      for (let n = 3; n <= 8; n++) {
        const r = buildRoute(n, def);
        expect(r.slots).toHaveLength(n);
        // Every non-ground limb target lands on a support or an interactive hold.
        const holds = [...r.slots, ...r.supports];
        for (const p of [r.rest, ...r.poses]) {
          for (const limb of [p.lh, p.rh, p.lf, p.rf]) {
            const onGround = limb.v <= def.ground + 1e-6;
            const onHold = holds.some((h) => Math.hypot(h.u - limb.u, h.v - limb.v) < 1e-6);
            expect(onGround || onHold).toBe(true);
          }
        }
      }
    }
  });
});

/** When only the fire road and the planting rule out a high-rise, the reason is given (DECISIONS.md B14). */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import { FIRE_ROAD_PROBLEM } from './variants';

describe('no plate fits the fire road and the planting', () => {
  // On a 20 m wide plot the 6 m ring around the narrowest usable high-rise plate (8 m) covers the
  // whole width, so no uniform shrink leaves ground for the planting. The front open space is
  // switched off so that it is the fire road alone that rules the high-rise out.
  it.each([
    [20, 30],
    [21, 45],
  ])('a %i x %i m condo offers no high-rise and says why, without blocking', (w, d) => {
    const s = scenario(rect(w, d), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], { disabledRuleIds: ['bma.front-access'] });
    const e = expectOk(evaluate(s));
    expect(e.designs.some((x) => x.regime === 'highRise')).toBe(false);
    const problem = e.problems.find((p) => p.message === FIRE_ROAD_PROBLEM);
    expect(problem?.blocking).toBe(false);
    // Without the planting rule a high-rise is generated, so the fire road is the reason.
    const without = expectOk(evaluate({ ...s, disabledRuleIds: ['bma.front-access', 'plan.permeable'] }));
    expect(without.problems.some((p) => p.message === FIRE_ROAD_PROBLEM)).toBe(false);
  });
});

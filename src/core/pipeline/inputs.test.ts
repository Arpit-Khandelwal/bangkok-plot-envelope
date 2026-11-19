/** Boundary validation of the scenario: bad station distances and waterway widths. */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import type { EdgeSpec } from '../types';
import { expectOk, NEIGHBOUR, rect, road, scenario } from './test-scenarios';

const FOUR: EdgeSpec[] = [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR];

describe('station distance at the boundary', () => {
  it.each([-1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NaN])(
    'treats %s as unknown, with a non-blocking problem, and does not apply the station route',
    (d) => {
      const e = expectOk(evaluate(scenario(rect(60, 60), FOUR, { stationDistanceM: d })));
      const problem = e.problems.find((p) => p.code === 'invalid-station-distance');
      expect(problem?.blocking).toBe(false);
      expect(problem?.message).toContain('distance to a station could not be determined');
      // A condo on a 12 m road with no station: capped at 10,000 m² of total floor area.
      for (const design of e.designs) expect(design.totals.grossFloorAreaM2).toBeLessThanOrEqual(10_000);
      const useSize = e.regimes.highRise.rules.rules.find((r) => r.id === 'plan.use-size');
      expect(useSize?.basis).toContain('unknown');
    },
  );

  it('keeps a valid distance of 0 m (the plot touches the station)', () => {
    const e = expectOk(evaluate(scenario(rect(60, 60), FOUR, { stationDistanceM: 0 })));
    expect(e.problems.some((p) => p.code === 'invalid-station-distance')).toBe(false);
    expect(Math.max(...e.designs.map((d) => d.totals.grossFloorAreaM2))).toBeGreaterThan(10_000);
  });
});

describe('waterway width at the boundary', () => {
  it.each([Number.NaN, 0, -3, 201, Number.POSITIVE_INFINITY])('blocks a waterway width of %s with a plain message', (w) => {
    const e = evaluate(scenario(rect(40, 40), [road(12), { kind: 'waterway', widthM: w }, NEIGHBOUR, NEIGHBOUR]));
    expect(e.ok).toBe(false);
    const problem = e.problems.find((p) => p.code === 'invalid-waterway-width');
    expect(problem?.blocking).toBe(true);
    expect(problem?.message).toContain('edge B');
    expect(problem?.message).not.toMatch(/NaN|unlimited|Infinity/);
    expect(e.site).not.toBeNull();
  });

  it('accepts a 200 m waterway', () => {
    expectOk(evaluate(scenario(rect(40, 40), [road(12), { kind: 'waterway', widthM: 200 }, NEIGHBOUR, NEIGHBOUR])));
  });
});

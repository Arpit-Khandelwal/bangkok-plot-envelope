/** The 6 m fire road (MR 33 ข้อ 3) and the permeable planting (plan ข้อ 14(2)) must both fit. */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { fireRoadGround } from '../measure/fire-planting';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import { shrinkUniform, unionAll } from '../geom';
import { firePlantingChecks } from './fire-planting';
import { measure } from './context';
import { checkInputFor, floorsOf } from './test-input';

const TITLE = 'Fire road and planting together';
const PLOT = scenario(rect(50, 50), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]);

describe('fire road and planting together', () => {
  it('fails, with both numbers, when the fire road leaves too little ground for planting', () => {
    // The full 38 x 38 plate inside the 6 m setbacks: the 6 m ring takes all 1,056 m² of open ground.
    const site = expectOk(evaluate(PLOT)).site;
    const plate = shrinkUniform([{ outer: site.ring, holes: [] }], 6);
    const input = checkInputFor(PLOT, 'highRise', floorsOf(plate, 9));
    const [check] = firePlantingChecks(input, measure(input.floors));
    expect(check?.status).toBe('fail');
    expect(check?.actual).toMatch(/1,056 m²/);
    expect(check?.actual).toMatch(/cannot both fit/);
  });

  it('passes by area when both fit, and says the layout is not drawn', () => {
    const e = expectOk(evaluate(scenario(rect(100, 100), [road(30), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    const check = designById(e, 'slender-tower').checks.find((c) => c.title === TITLE);
    expect(check?.status).toBe('pass');
    expect(check?.actual).toMatch(/by area\. The layout itself is not drawn/);
  });

  it('shrinks the high-rise plate until the planting fits beside the fire road', () => {
    // Before the fix the 50 x 50 high-rise filled the 38 x 38 plate and the check only warned.
    const e = expectOk(evaluate(PLOT));
    for (const d of e.designs.filter((x) => x.regime === 'highRise')) {
      const check = d.checks.find((c) => c.title === TITLE);
      expect(check?.status).toBe('pass');
      expect(d.totals.coverageM2).toBeLessThan(38 * 38);
      const ground = unionAll(d.floors.map((f) => f.outline));
      expect(fireRoadGround(e.site, ground).leftM2).toBeGreaterThan(0);
    }
  });

  it('is not shown for a low-rise design', () => {
    const e = expectOk(evaluate(PLOT));
    expect(designById(e, 'low-rise-block').checks.some((c) => c.title === TITLE)).toBe(false);
  });
});

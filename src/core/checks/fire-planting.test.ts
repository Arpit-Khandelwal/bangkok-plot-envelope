/** The 6 m fire road (MR 33 ข้อ 3) and the permeable planting (plan ข้อ 14(2)) must both fit. */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';

const TITLE = 'Fire road and planting together';

describe('fire road and planting together', () => {
  it('warns, with both numbers, when the fire road leaves too little ground for planting', () => {
    // 50 x 50 condo, high-rise on the full 38 x 38 plate: the 6 m ring takes all 1,056 m² of open ground.
    const e = expectOk(evaluate(scenario(rect(50, 50), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    const check = designById(e, 'high-rise-max').checks.find((c) => c.title === TITLE);
    expect(check?.status).toBe('warn');
    expect(check?.actual).toMatch(/1,056 m²/);
    expect(check?.required).toMatch(/375 m²/);
  });

  it('is information only when both fit', () => {
    const e = expectOk(evaluate(scenario(rect(100, 100), [road(30), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    const check = designById(e, 'slender-tower').checks.find((c) => c.title === TITLE);
    expect(check?.status).toBe('info');
  });

  it('is not shown for a low-rise design and never fails', () => {
    const e = expectOk(evaluate(scenario(rect(50, 50), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    expect(designById(e, 'low-rise-block').checks.some((c) => c.title === TITLE)).toBe(false);
    for (const d of e.designs) expect(d.checks.filter((c) => c.title === TITLE).every((c) => c.status !== 'fail')).toBe(true);
  });
});

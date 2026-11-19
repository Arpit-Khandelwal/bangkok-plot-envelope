/** The informational fire-road check (MR 33 ข้อ 3) says what the rule asks and what the tool does not verify. */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import { FIRE_PLANTING_TITLE } from './fire-planting';

const RULE = 'mr33.fire-road';

describe('fire-road check', () => {
  const e = expectOk(evaluate(scenario(rect(50, 50), [road(30), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
  const high = designById(e, 'high-rise-max');
  const checks = high.checks.filter((c) => c.ruleId === RULE);
  const info = checks.find((c) => c.title !== FIRE_PLANTING_TITLE);

  it('states the requirement and that the tool does not lay the road out', () => {
    expect(info?.status).toBe('info');
    expect(info?.required).toBe('A 6 m wide fire road must run all around the building, open to the sky.');
    expect(info?.actual).toMatch(/^The 6 m setback leaves room for it on every side; the tool does not lay it out\./);
  });

  it('does not claim the road lies in the setback as a fact', () => {
    expect(info?.actual).not.toMatch(/lies within/);
    const rule = e.regimes.highRise.rules.rules.find((r) => r.id === RULE);
    expect(rule?.basis ?? '').not.toMatch(/can lie inside/);
  });

  it('does not claim room for the road when the 6 m setback is switched off', () => {
    const off = expectOk(evaluate(scenario(rect(50, 50), [road(30), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], { disabledRuleIds: ['mr33.boundary-6m'] })));
    const d = off.designs.find((x) => x.regime === 'highRise');
    const c = d?.checks.find((x) => x.ruleId === RULE && x.title !== FIRE_PLANTING_TITLE);
    expect(c?.actual).toMatch(/^With the 6 m setback switched off, the tool cannot say there is room for it/);
  });

  it('points to the separate check on whether the planting fits beside it', () => {
    expect(checks.some((c) => c.title === FIRE_PLANTING_TITLE)).toBe(true);
    expect(info?.actual).toContain(FIRE_PLANTING_TITLE);
  });
});

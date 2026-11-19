/** Switching a rule off visibly changes the result, and marks it hypothetical. */
import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from './pipeline/test-scenarios';

const EDGES = [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR];
const run = (disabledRuleIds: readonly string[] = []) =>
  expectOk(evaluate(scenario(rect(50, 50), EDGES, { disabledRuleIds })));

describe('rule switches', () => {
  const base = run();

  it('is not hypothetical with every rule on', () => {
    expect(base.hypothetical).toBe(false);
  });

  it('enlarges the low-rise footprint when the side setback is off', () => {
    const off = run(['mr55.boundary-openings']);
    // Neighbours then only need the 2 m clear space: (50 - 2 - 2) x (50 - 2 - 2) = 46 x 46.
    expect(off.regimes.lowRise.envelope?.footprintAreaM2).toBeCloseTo(2116, 0);
    expect(off.regimes.lowRise.envelope?.footprintAreaM2 ?? 0).toBeGreaterThan(base.regimes.lowRise.envelope?.footprintAreaM2 ?? 0);
    expect(off.hypothetical).toBe(true);
  });

  it('enlarges the high-rise footprint when the 6 m high-rise setback is off', () => {
    const off = run(['mr33.boundary-6m']);
    expect(off.regimes.highRise.envelope?.footprintAreaM2 ?? 0).toBeGreaterThan(base.regimes.highRise.envelope?.footprintAreaM2 ?? 0);
  });

  it('raises the high-rise envelope when the road height plane is off', () => {
    const off = run(['mr55.height-2x']);
    expect(off.regimes.highRise.envelope?.maxHeightM ?? 0).toBeGreaterThan(base.regimes.highRise.envelope?.maxHeightM ?? 0);
    expect(off.problems.map((p) => p.code)).toContain('height-limit-off');
    expect(off.designs.some((d) => d.checks.some((c) => c.ruleId === 'mr55.height-2x'))).toBe(false);
  });

  it('raises the floor area when the plan FAR is off', () => {
    const off = run(['plan.far']);
    expect(off.regimes.highRise.rules.maxGfaM2).toBeGreaterThan(base.regimes.highRise.rules.maxGfaM2);
    const before = designById(base, 'high-rise-max').totals.grossFloorAreaM2;
    const after = designById(off, 'high-rise-max').totals.grossFloorAreaM2;
    expect(after).toBeGreaterThan(before);
    expect(off.designs.some((d) => d.checks.some((c) => c.ruleId === 'plan.far'))).toBe(false);
  });

  it('names the geometric rule as binding when the height cap stops the floors short of FAR', () => {
    // 30 x 40 on a 6 m soi: the low-rise block stops at the 23 m roof-deck cap at 5,636 m², under 6,000.
    const e = expectOk(evaluate(scenario(rect(30, 40), [road(6), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    const rules = e.regimes.lowRise.rules;
    expect(rules.bindingGfaRuleId).toBe('mr33.highrise-threshold');
    expect(rules.rules.find((r) => r.id === 'plan.far')?.binding).toBe(false);
    expect(rules.rules.find((r) => r.id === 'mr33.highrise-threshold')?.binding).toBe(true);
  });
});

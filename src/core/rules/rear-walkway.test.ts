/** Bangkok ordinance ข้อ 52(7): a 2 m walkway behind a commercial building (DECISIONS.md B13). */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';

const EDGES = [road(16), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR];
const RULE = 'bma.rear-walkway';

describe('rear walkway', () => {
  it('applies to an office, cited as an assumption, and says it changes no number here', () => {
    const e = expectOk(evaluate(scenario(rect(60, 60), EDGES, { buildingType: 'office' })));
    for (const regime of [e.regimes.lowRise, e.regimes.highRise]) {
      const rule = regime.rules.rules.find((r) => r.id === RULE);
      expect(rule?.citations).toEqual([expect.objectContaining({ clause: 'ข้อ 52(7)', confidence: 'assumption' })]);
      expect(rule?.requirement).toMatch(/^Keep the building at least 2 m from neighbouring land/);
      expect(rule?.requirement).toMatch(/so this rule changes no number here\.$/);
      expect(rule?.binding).toBe(false);
    }
  });

  it('does not apply to a condo', () => {
    const e = expectOk(evaluate(scenario(rect(60, 60), EDGES)));
    expect(e.regimes.lowRise.rules.rules.some((r) => r.id === RULE)).toBe(false);
  });

  it('sets the setback when the larger setbacks are switched off', () => {
    const off = ['mr55.boundary-openings', 'bma.clear-space'];
    const e = expectOk(evaluate(scenario(rect(60, 60), EDGES, { buildingType: 'office', disabledRuleIds: off })));
    const rule = e.regimes.lowRise.rules.rules.find((r) => r.id === RULE);
    expect(rule?.requirement).not.toMatch(/changes no number/);
    expect(e.regimes.lowRise.rules.setbacks.filter((s) => s.ruleId === RULE).map((s) => s.distanceM)).toEqual([2, 2, 2]);
  });
});

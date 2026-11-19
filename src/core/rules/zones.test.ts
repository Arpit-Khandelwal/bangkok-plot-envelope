import { describe, expect, it } from 'vitest';
import { BUILDING_CONTROL_RULES, ZONES } from './data';
import { cite } from './data/sources';
import type { ZoneData } from './data/spec';
import { ZONE_2556_Y7 } from './data/zones/plan-2556-y7';
import { resolveRulesWith } from './resolve';
import { frontedSite, scenarioFor } from './test-helpers';

/** A ย.6 fixture built as data only: clause 13, FAR 4.5, OSR 6.5%, same condo test as ย.7. */
const Y6_FIXTURE: ZoneData = {
  ...ZONE_2556_Y7,
  code: 'ย.6',
  rules: ZONE_2556_Y7.rules.map((rule) => {
    const meta = { ...rule.meta, citations: [cite('Plan2556', 'ข้อ 13', 'verified')] };
    if (rule.kind === 'far') return { ...rule, ratio: 4.5, meta };
    if (rule.kind === 'openSpace') return { ...rule, share: 0.065, meta };
    return { ...rule, meta };
  }),
};

describe('adding a zone is a data addition', () => {
  it('a ย.6 entry resolves with its own FAR and OSR and no code change', () => {
    const site = frontedSite(50, 50, 12);
    const scenario = scenarioFor(site, { zone: { code: 'ย.6', planVersion: '2556' }, stationDistanceM: 300 });
    const result = resolveRulesWith(site, scenario, [...ZONES, Y6_FIXTURE], BUILDING_CONTROL_RULES);
    expect(result.highRise.maxGfaM2).toBe(11_250);
    expect(result.highRise.bindingGfaRuleId).toBe('plan.far');
    expect(result.highRise.openSpace[0]).toEqual({ ruleId: 'plan.osr', basis: 'totalFloorArea', share: 0.065 });
  });
});

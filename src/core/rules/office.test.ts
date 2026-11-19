import { describe, expect, it } from 'vitest';
import { frontedSite, resolve, ruleOf } from './test-helpers';

const OFFICE = { buildingType: 'office' } as const;

describe('office use-size test (Plan ข้อ 14(13)), measured on operating area', () => {
  it('400 m² plot on a 16 m road: FAR limits total floor area to 2,000 m²', () => {
    const result = resolve(frontedSite(20, 20, 16), OFFICE);
    for (const regime of [result.lowRise, result.highRise]) {
      expect(regime.maxGfaM2).toBe(2_000);
      expect(regime.bindingGfaRuleId).toBe('plan.far');
      expect(regime.maxMainUseM2).toBe(10_000);
      expect(ruleOf(regime, 'plan.use-size').binding).toBe(false);
    }
  });

  it('no 16 m road and no station: operating area limited to 1,000 m²', () => {
    const result = resolve(frontedSite(50, 50, 12), { ...OFFICE, stationDistanceM: null });
    expect(result.highRise.maxMainUseM2).toBe(1_000);
    expect(result.highRise.maxGfaM2).toBe(12_500);
    expect(result.highRise.gfaLimits).toContainEqual({
      ruleId: 'plan.use-size',
      limitM2: 1_000,
      measure: 'mainUseFloorArea',
      exclusive: false,
    });
    const rule = ruleOf(result.highRise, 'plan.use-size');
    expect(rule.binding).toBe(true);
    expect(rule.requirement).toBe(
      'An office may have at most 1,000 m² of operating area here; more needs a road at least 16 m wide with at least 16 m of frontage on it, or a mass-transit station platform within 500 m.',
    );
  });

  it('16 m road with only 15 m of frontage fails the road route', () => {
    const result = resolve(frontedSite(15, 100, 16), { ...OFFICE, stationDistanceM: 800 });
    expect(result.highRise.maxMainUseM2).toBe(1_000);
  });

  it('with a station: 10,000 m² hard cap on operating area, below the FAR limit', () => {
    const result = resolve(frontedSite(100, 50, 12), { ...OFFICE, stationDistanceM: 300 });
    expect(result.highRise.maxMainUseM2).toBe(10_000);
    expect(result.highRise.maxGfaM2).toBe(25_000);
    expect(result.highRise.bindingGfaRuleId).toBe('plan.far');
    const rule = ruleOf(result.highRise, 'plan.use-size');
    expect(rule.binding).toBe(true);
    expect(rule.requirement).toContain('not allowed in this zone at all');
  });

  it('the cap stays at 10,000 m² even on a 30 m road with a station', () => {
    const result = resolve(frontedSite(100, 100, 30), { ...OFFICE, stationDistanceM: 100 });
    expect(result.highRise.maxMainUseM2).toBe(10_000);
  });

  it('uses office parking, floor height and the 10% open-space shares, and has no EIA rule', () => {
    const result = resolve(frontedSite(50, 50, 12), { ...OFFICE, stationDistanceM: 300 });
    expect(result.lowRise.parking).toEqual({ m2PerStall: 60, stallsPerLargeUnit: 0, ruleId: 'bma.parking' });
    expect(result.lowRise.minFloorToFloorM).toBe(3);
    expect(result.highRise.openSpace).toEqual([
      { ruleId: 'plan.osr', basis: 'totalFloorArea', share: 0.06 },
      { ruleId: 'bma.open-space-plot', basis: 'plotArea', share: 0.1 },
      { ruleId: 'mr55.open-space-floor', basis: 'largestFloor', share: 0.1 },
    ]);
    expect(result.lowRise.rules.some((r) => r.id === 'eia.threshold')).toBe(false);
    expect(ruleOf(result.lowRise, 'plan.permeable').category).toBe('openSpace');
  });
});

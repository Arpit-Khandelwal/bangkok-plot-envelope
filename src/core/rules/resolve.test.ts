import { describe, expect, it } from 'vitest';
import type { RegimeRules } from '../types';
import { BLOCK_NO_ROAD, BLOCK_ZONE_UNSUPPORTED } from './data';
import { frontedSite, NEIGHBOUR, rectSite, resolve, ruleOf } from './test-helpers';

const STATION_FAR = { stationDistanceM: 800 } as const;

function expectUnavailable(rules: RegimeRules, blockId: string): void {
  expect(rules.available).toBe(false);
  expect(rules.blockedBy).toEqual([blockId]);
}

describe('disabling floor-area rules', () => {
  const site = frontedSite(50, 50, 12);

  it('without plan.far and plan.use-size the next limit binds', () => {
    const result = resolve(site, { ...STATION_FAR, disabledRuleIds: ['plan.far', 'plan.use-size'] });
    expect(result.highRise.maxGfaM2).toBe(25_000);
    expect(result.highRise.bindingGfaRuleId).toBe('mr33.far-10');
    expect(result.lowRise.maxGfaM2).toBe(10_000);
    expect(ruleOf(result.highRise, 'plan.far')).toMatchObject({ disabled: true, binding: false });
    expect(result.highRise.gfaLimits.some((l) => l.ruleId === 'plan.far')).toBe(false);
  });

  it('then without mr33.far-10 the 30,000 m² access limit binds', () => {
    const result = resolve(site, { ...STATION_FAR, disabledRuleIds: ['plan.far', 'plan.use-size', 'mr33.far-10'] });
    expect(result.highRise.maxGfaM2).toBe(30_000);
    expect(result.highRise.bindingGfaRuleId).toBe('mr33.access-road');
  });

  it('with no floor-area limit left, maxGfaM2 is Infinity', () => {
    const disabledRuleIds = ['plan.far', 'plan.use-size', 'mr33.far-10', 'mr33.access-road', 'mr33.highrise-threshold'];
    const result = resolve(site, { ...STATION_FAR, disabledRuleIds });
    expect(result.highRise.maxGfaM2).toBe(Number.POSITIVE_INFINITY);
    expect(result.highRise.bindingGfaRuleId).toBeNull();
    expect(result.lowRise.maxGfaM2).toBe(Number.POSITIVE_INFINITY);
    expect(result.lowRise.roofDeckCapM).toBeNull();
    expect(result.lowRise.roofDeckCapRuleId).toBeNull();
    for (const rule of [...result.lowRise.rules, ...result.highRise.rules]) {
      expect(rule.binding && rule.category === 'density').toBe(false);
      expect(rule.requirement).not.toMatch(/Infinity|unlimited|NaN|undefined/);
    }
  });

  it('a disabled height rule leaves no planes, a disabled parking rule asks for no spaces', () => {
    const result = resolve(site, { disabledRuleIds: ['mr55.height-2x', 'bma.parking', 'mr55.floor-height'] });
    expect(result.highRise.heightPlanes).toEqual([]);
    expect(result.highRise.parking.m2PerStall).toBe(Number.POSITIVE_INFINITY);
    expect(result.highRise.parking.stallsPerLargeUnit).toBe(0);
    expect(result.highRise.minFloorToFloorM).toBe(0);
    expect(ruleOf(result.highRise, 'mr55.height-2x').disabled).toBe(true);
  });

  it('the parking-in-FAR setting changes the wording, not the limit', () => {
    const counted = resolve(site, { parkingCountsInFar: true });
    const excluded = resolve(site, { parkingCountsInFar: false });
    expect(excluded.highRise.maxGfaM2).toBe(counted.highRise.maxGfaM2);
    expect(ruleOf(excluded.highRise, 'plan.far').basis).toContain('leave parking floors out');
  });
});

describe('cases that give no regime, without throwing', () => {
  const site = frontedSite(50, 50, 12);

  it('unsupported zone code', () => {
    const result = resolve(site, { zone: { code: 'ย.6', planVersion: '2556' } });
    expectUnavailable(result.lowRise, BLOCK_ZONE_UNSUPPORTED);
    expectUnavailable(result.highRise, BLOCK_ZONE_UNSUPPORTED);
    expect(BLOCK_ZONE_UNSUPPORTED).toBe('plan.zone-unsupported');
  });

  it('known zone code under another plan version', () => {
    const result = resolve(site, { zone: { code: 'ย.7', planVersion: 'draft-r4' } });
    expectUnavailable(result.highRise, BLOCK_ZONE_UNSUPPORTED);
  });

  it('no zone found', () => {
    const result = resolve(site, { zone: null });
    expectUnavailable(result.lowRise, BLOCK_ZONE_UNSUPPORTED);
  });

  it('no road edge', () => {
    const landlocked = rectSite(50, 50, [NEIGHBOUR, NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]);
    const result = resolve(landlocked);
    expectUnavailable(result.lowRise, BLOCK_NO_ROAD);
    expectUnavailable(result.highRise, BLOCK_NO_ROAD);
  });
});

describe('purity', () => {
  it('does not mutate its inputs', () => {
    const site = frontedSite(50, 50, 12);
    const before = JSON.stringify(site);
    resolve(site, { stationDistanceM: 300, disabledRuleIds: ['plan.far'] });
    expect(JSON.stringify(site)).toBe(before);
  });

  it('writes every requirement as a full sentence with formatted numbers', () => {
    const result = resolve(frontedSite(100, 100, 12), { stationDistanceM: 300 });
    for (const rule of [...result.lowRise.rules, ...result.highRise.rules]) {
      expect(rule.requirement).toMatch(/^[A-Z].*\.$/);
      expect(rule.requirement).not.toMatch(/\d{5}/);
      expect(rule.requirement).not.toMatch(/Infinity|NaN|undefined/);
    }
  });
});

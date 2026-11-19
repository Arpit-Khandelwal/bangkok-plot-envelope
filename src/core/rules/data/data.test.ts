import { describe, expect, it } from 'vitest';
import type { BuildingType, RegimeId } from '../../types';
import { BUILDING_CONTROL_RULES, rulesFor, ZONES } from '.';
import type { RuleSpec } from './spec';

const ALL_RULES: readonly RuleSpec[] = [...ZONES.flatMap((z) => z.rules), ...BUILDING_CONTROL_RULES];
const REGIMES: readonly RegimeId[] = ['lowRise', 'highRise'];
const TYPES: readonly BuildingType[] = ['condo', 'office'];
const ID_PATTERN = /^[a-z0-9]+\.[a-z0-9]+(-[a-z0-9]+)*$/;

describe('rule data', () => {
  it.each(ALL_RULES.map((r) => [r.meta.id, r] as const))('%s has a valid id, title and citations', (_id, rule) => {
    expect(rule.meta.id).toMatch(ID_PATTERN);
    expect(rule.meta.title.trim()).not.toBe('');
    expect(rule.meta.citations.length).toBeGreaterThan(0);
    for (const c of rule.meta.citations) {
      expect(c.url.startsWith('https://')).toBe(true);
      expect(c.clause.trim()).not.toBe('');
      expect(c.document.trim()).not.toBe('');
      expect(['verified', 'corroborated', 'assumption']).toContain(c.confidence);
    }
  });

  it('has the expected rule ids', () => {
    const ids = new Set(ALL_RULES.map((r) => r.meta.id));
    for (const id of [
      'plan.far',
      'plan.osr',
      'plan.use-size',
      'mr33.boundary-6m',
      'mr33.access-road',
      'mr33.highrise-threshold',
      'mr55.road-setback',
      'mr55.height-2x',
      'mr55.boundary-openings',
      'bma.open-space-plot',
      'mr55.open-space-floor',
      'bma.parking',
      'mr55.waterway',
      'eia.threshold',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('never has two rules with one id in the same regime and building type', () => {
    for (const zone of ZONES) {
      for (const regime of REGIMES) {
        for (const type of TYPES) {
          const ids = rulesFor(zone, regime, type).map((r) => r.meta.id);
          expect(new Set(ids).size).toBe(ids.length);
        }
      }
    }
  });

  it('keeps tiers and bands in ascending order', () => {
    for (const rule of ALL_RULES) {
      const bounds =
        rule.kind === 'useSize'
          ? rule.tiers.map((t) => t.upToM2)
          : rule.kind === 'roadSetback'
            ? rule.bands.map((b) => b.untilRowM)
            : rule.kind === 'waterwaySetback'
              ? rule.bands.map((b) => b.belowWidthM)
              : rule.kind === 'access'
                ? rule.tiers.map((t) => t.minRowM)
                : [];
      const finite = bounds.map((b) => b ?? Number.POSITIVE_INFINITY);
      expect(finite).toEqual([...finite].sort((a, b) => a - b));
    }
  });

  it('ย.7 under the 2556 plan has FAR 5 and OSR 6%', () => {
    const zone = ZONES.find((z) => z.code === 'ย.7' && z.planVersion === '2556');
    const far = zone?.rules.find((r) => r.kind === 'far');
    const osr = zone?.rules.find((r) => r.meta.id === 'plan.osr');
    expect(far?.kind === 'far' && far.ratio).toBe(5);
    expect(osr?.kind === 'openSpace' && osr.share).toBe(0.06);
  });
});

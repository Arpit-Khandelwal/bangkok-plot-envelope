import { describe, expect, it } from 'vitest';
import { BUILDING_CONTROL_RULES } from './data';
import type { RoadSetbackBand } from './data/spec';
import { roadSetbackFromEdge } from './kinds/road-setback';
import { frontedSite, NEIGHBOUR, rectSite, resolve, road, ruleOf, waterway } from './test-helpers';

function tableBands(): readonly RoadSetbackBand[] {
  const spec = BUILDING_CONTROL_RULES.find((r) => r.kind === 'roadSetback');
  if (spec?.kind !== 'roadSetback') throw new Error('road setback data missing');
  return spec.bands;
}

function table(rowWidthM: number): number {
  const result = roadSetbackFromEdge(tableBands(), rowWidthM);
  if (result === null) throw new Error(`no band for ${rowWidthM}`);
  return result.distanceM;
}

// Hand-computed: under 10 m -> 6 - ROW/2; 10 to 20 m -> ROW/10; over 20 m -> 2.
const TABLE_CASES: readonly (readonly [number, number])[] = [
  [4, 4],
  [5.99, 3.005],
  [6, 3],
  [8, 2],
  [9.99, 1.005],
  [10, 1],
  [15, 1.5],
  [20, 2],
  [20.01, 2],
  [30, 2],
];

describe('road-width setback table (MR 55 ข้อ 41 / BMA ข้อ 50), from the plot edge', () => {
  it.each(TABLE_CASES)('right-of-way %s m gives %s m', (row, expected) => {
    expect(table(row)).toBeCloseTo(expected, 9);
  });

  it('is continuous at 10 m and at 20 m', () => {
    const eps = 1e-9;
    expect(table(10 - eps)).toBeCloseTo(table(10), 6);
    expect(table(20)).toBeCloseTo(table(20 + eps), 6);
  });
});

describe('road-edge setback per regime', () => {
  // Low-rise: the larger of the table and the 2 m BMA ข้อ 55 clear space.
  const lowRise: readonly (readonly [number, number, string])[] = [
    [4, 4, 'mr55.road-setback'],
    [5.99, 3.005, 'mr55.road-setback'],
    [6, 3, 'mr55.road-setback'],
    [8, 2, 'mr55.road-setback'],
    [9.99, 2, 'bma.clear-space'],
    [10, 2, 'bma.clear-space'],
    [15, 2, 'bma.clear-space'],
    [20, 2, 'mr55.road-setback'],
    [20.01, 2, 'mr55.road-setback'],
    [30, 2, 'mr55.road-setback'],
  ];

  it.each(lowRise)('low-rise, right-of-way %s m: %s m set by %s', (row, distance, ruleId) => {
    const edge0 = resolve(frontedSite(50, 50, row)).lowRise.setbacks[0];
    expect(edge0?.distanceM).toBeCloseTo(distance, 9);
    expect(edge0?.ruleId).toBe(ruleId);
  });

  it.each(TABLE_CASES)('low-rise without the clear space gives the table: %s m -> %s m', (row, expected) => {
    const result = resolve(frontedSite(50, 50, row), { disabledRuleIds: ['bma.clear-space'] });
    expect(result.lowRise.setbacks[0]?.distanceM).toBeCloseTo(expected, 9);
  });

  it.each(TABLE_CASES)('high-rise, right-of-way %s m: 6 m from MR 33 ข้อ 4', (row) => {
    const edge0 = resolve(frontedSite(50, 50, row)).highRise.setbacks[0];
    expect(edge0).toEqual({ edgeIndex: 0, distanceM: 6, ruleId: 'mr33.boundary-6m' });
  });

  it('explains the conversion from the centreline in the basis', () => {
    const rule = ruleOf(resolve(frontedSite(50, 50, 8)).lowRise, 'mr55.road-setback');
    expect(rule.basis).toContain(
      'The road is 8 m wide, under 10 m, so the building line is 6 m from the road centreline: 2 m inside the plot edge.',
    );
    expect(rule.requirement).toBe('Keep the building at least 2 m back from the 8 m road (edge 1).');
  });
});

describe('side, rear and waterway setbacks', () => {
  it('low-rise sides are 3 m for walls with openings; high-rise sides are 6 m', () => {
    const result = resolve(frontedSite(50, 50, 12));
    for (const i of [1, 2, 3]) {
      expect(result.lowRise.setbacks[i]).toEqual({ edgeIndex: i, distanceM: 3, ruleId: 'mr55.boundary-openings' });
      expect(result.highRise.setbacks[i]).toEqual({ edgeIndex: i, distanceM: 6, ruleId: 'mr33.boundary-6m' });
    }
  });

  it('waterway under 10 m wide: 3 m low-rise, 6 m high-rise from MR 33', () => {
    const site = rectSite(50, 50, [road(12), NEIGHBOUR, waterway(8), NEIGHBOUR]);
    const result = resolve(site);
    expect(result.lowRise.setbacks[2]).toEqual({ edgeIndex: 2, distanceM: 3, ruleId: 'mr55.waterway' });
    expect(result.highRise.setbacks[2]).toEqual({ edgeIndex: 2, distanceM: 6, ruleId: 'mr33.boundary-6m' });
  });

  it('waterway 10 m or wider: 6 m in both regimes, named after the waterway rule', () => {
    const site = rectSite(50, 50, [road(12), NEIGHBOUR, waterway(10), NEIGHBOUR]);
    const result = resolve(site);
    expect(result.lowRise.setbacks[2]).toEqual({ edgeIndex: 2, distanceM: 6, ruleId: 'mr55.waterway' });
    expect(result.highRise.setbacks[2]).toEqual({ edgeIndex: 2, distanceM: 6, ruleId: 'mr55.waterway' });
  });

  it('disabling mr33.boundary-6m drops high-rise sides to 3 m and the road edge to 2 m', () => {
    const result = resolve(frontedSite(50, 50, 12), { disabledRuleIds: ['mr33.boundary-6m'] });
    expect(result.highRise.setbacks.map((s) => s.distanceM)).toEqual([2, 3, 3, 3]);
    expect(result.highRise.setbacks[1]?.ruleId).toBe('mr55.boundary-openings');
    const rule = ruleOf(result.highRise, 'mr33.boundary-6m');
    expect(rule.disabled).toBe(true);
    expect(rule.binding).toBe(false);
  });

  it('marks as binding only the setback rules that win on some edge', () => {
    const result = resolve(frontedSite(50, 50, 12));
    expect(ruleOf(result.lowRise, 'bma.clear-space').binding).toBe(true);
    expect(ruleOf(result.lowRise, 'mr55.boundary-openings').binding).toBe(true);
    expect(ruleOf(result.lowRise, 'mr55.road-setback').binding).toBe(false);
    expect(ruleOf(result.highRise, 'mr33.boundary-6m').binding).toBe(true);
    expect(ruleOf(result.highRise, 'mr55.boundary-openings').binding).toBe(false);
  });
});

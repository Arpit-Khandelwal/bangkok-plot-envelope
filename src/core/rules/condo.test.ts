import { describe, expect, it } from 'vitest';
import { bindingIds, frontedSite, NEIGHBOUR, rectSite, resolve, road, ruleOf } from './test-helpers';

function limitOf(rules: ReturnType<typeof resolve>['lowRise'], ruleId: string) {
  return rules.gfaLimits.find((l) => l.ruleId === ruleId);
}

describe('condo, 50 x 50 plot (2,500 m²) on a 12 m road, station 300 m away', () => {
  const result = resolve(frontedSite(50, 50, 12), { stationDistanceM: 300 });

  it('high-rise: FAR 5 gives 12,500 m², and plan.far is binding', () => {
    expect(result.highRise.available).toBe(true);
    expect(result.highRise.maxGfaM2).toBe(12_500);
    expect(result.highRise.bindingGfaRuleId).toBe('plan.far');
    expect(ruleOf(result.highRise, 'plan.far').binding).toBe(true);
    // Station route passes, so no use-size limit; 12 m road is under 18 m, so 30,000 applies.
    expect(limitOf(result.highRise, 'plan.use-size')).toBeUndefined();
    expect(limitOf(result.highRise, 'mr33.access-road')?.limitM2).toBe(30_000);
    expect(limitOf(result.highRise, 'mr33.far-10')?.limitM2).toBe(25_000);
    expect(result.highRise.roofDeckCapM).toBeNull();
  });

  it('low-rise: capped just under 10,000 m² by the extra-large threshold', () => {
    expect(result.lowRise.available).toBe(true);
    expect(result.lowRise.maxGfaM2).toBe(10_000);
    expect(result.lowRise.bindingGfaRuleId).toBe('mr33.highrise-threshold');
    expect(limitOf(result.lowRise, 'mr33.highrise-threshold')?.exclusive).toBe(true);
    expect(limitOf(result.lowRise, 'plan.far')?.limitM2).toBe(12_500);
    expect(result.lowRise.roofDeckCapM).toBe(23);
    expect(result.lowRise.roofDeckCapRuleId).toBe('mr33.highrise-threshold');
  });

  it('states the FAR requirement with this plot’s numbers', () => {
    expect(ruleOf(result.highRise, 'plan.far').requirement).toBe(
      'Total floor area at most 12,500 m²: 5 times the plot area of 2,500 m², under the zone plan.',
    );
    expect(ruleOf(result.highRise, 'plan.far').basis).toContain('Parking floors count toward this total');
  });

  it('gives condo parking, floor height and open-space entries', () => {
    expect(result.lowRise.parking).toEqual({ m2PerStall: 120, stallsPerLargeUnit: 1, ruleId: 'bma.parking' });
    expect(result.lowRise.minFloorToFloorM).toBe(2.6);
    expect(result.highRise.openSpace).toEqual([
      { ruleId: 'plan.osr', basis: 'totalFloorArea', share: 0.06 },
      { ruleId: 'bma.open-space-plot', basis: 'plotArea', share: 0.3 },
      { ruleId: 'mr55.open-space-floor', basis: 'largestFloor', share: 0.3 },
    ]);
    expect(ruleOf(result.highRise, 'plan.osr').requirement).toBe(
      'Leave open space of at least 6% of the total floor area: 750 m² if the full 12,500 m² is built.',
    );
  });

  it('includes the EIA and permeable-planting rules as information only', () => {
    expect(ruleOf(result.lowRise, 'eia.threshold').category).toBe('process');
    expect(ruleOf(result.lowRise, 'plan.permeable').category).toBe('openSpace');
  });

  it('orders rules by category', () => {
    const order = ['use', 'density', 'height', 'setback', 'openSpace', 'access', 'parking', 'process'];
    const ranks = result.highRise.rules.map((r) => order.indexOf(r.category));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ranks.every((r) => r >= 0)).toBe(true);
  });
});

describe('condo use-size test (Plan ข้อ 14(11), 36(4), 37)', () => {
  it('station 800 m, 12 m road: limited to 10,000 m² by plan.use-size', () => {
    const result = resolve(frontedSite(50, 50, 12), { stationDistanceM: 800 });
    expect(result.highRise.maxGfaM2).toBe(10_000);
    expect(result.highRise.bindingGfaRuleId).toBe('plan.use-size');
    expect(bindingIds(result.highRise)).toContain('plan.use-size');
    expect(bindingIds(result.highRise)).not.toContain('plan.far');
    // In low-rise the exclusive threshold of the same size is stricter.
    expect(result.lowRise.bindingGfaRuleId).toBe('mr33.highrise-threshold');
    expect(ruleOf(result.lowRise, 'plan.use-size').binding).toBe(false);
  });

  it('a null station distance is treated as no station route, and says so', () => {
    const result = resolve(frontedSite(50, 50, 12), { stationDistanceM: null });
    expect(result.highRise.maxGfaM2).toBe(10_000);
    expect(ruleOf(result.highRise, 'plan.use-size').basis).toContain('treated as not available');
  });

  it('30 m road with 20 m frontage fails the road route', () => {
    const result = resolve(frontedSite(20, 125, 30), { stationDistanceM: 800 });
    expect(result.highRise.maxGfaM2).toBe(10_000);
    expect(result.highRise.bindingGfaRuleId).toBe('plan.use-size');
    expect(ruleOf(result.highRise, 'plan.use-size').basis).toContain('The road route fails');
  });

  it('30 m road with 30 m frontage passes: FAR binds (30 x 100 plot)', () => {
    const result = resolve(frontedSite(30, 100, 30), { stationDistanceM: 800 });
    expect(result.highRise.maxGfaM2).toBe(15_000);
    expect(result.highRise.bindingGfaRuleId).toBe('plan.far');
  });

  it('frontage sums the edges on the same road', () => {
    const site = rectSite(20, 125, [road(30, 'A'), road(30, 'A'), NEIGHBOUR, NEIGHBOUR]);
    const result = resolve(site, { stationDistanceM: 800 });
    expect(result.highRise.maxGfaM2).toBe(12_500);
  });

  it('station exactly 500 m passes; 500.01 m fails', () => {
    const at = resolve(frontedSite(50, 50, 12), { stationDistanceM: 500 });
    const beyond = resolve(frontedSite(50, 50, 12), { stationDistanceM: 500.01 });
    expect(at.highRise.maxGfaM2).toBe(12_500);
    expect(beyond.highRise.maxGfaM2).toBe(10_000);
  });
});

describe('high-rise access (MR 33 ข้อ 2)', () => {
  it('frontage 11.9 m blocks the high-rise; 12.0 m allows it', () => {
    const short = resolve(frontedSite(11.9, 50, 12), { stationDistanceM: 300 });
    const enough = resolve(frontedSite(12, 50, 12), { stationDistanceM: 300 });
    expect(short.highRise.available).toBe(false);
    expect(short.highRise.blockedBy).toEqual(['mr33.access-road']);
    expect(short.lowRise.available).toBe(true);
    expect(enough.highRise.available).toBe(true);
    expect(enough.highRise.blockedBy).toEqual([]);
  });

  it('right-of-way 9.99 m blocks the high-rise; 10 m allows it', () => {
    expect(resolve(frontedSite(50, 50, 9.99)).highRise.available).toBe(false);
    expect(resolve(frontedSite(50, 50, 10)).highRise.available).toBe(true);
  });

  it('30,000 m² limit at right-of-way 17.9 m, none at 18 m (100 x 100 plot)', () => {
    const narrow = resolve(frontedSite(100, 100, 17.9), { stationDistanceM: 300 });
    const wide = resolve(frontedSite(100, 100, 18), { stationDistanceM: 300 });
    expect(narrow.highRise.maxGfaM2).toBe(30_000);
    expect(narrow.highRise.bindingGfaRuleId).toBe('mr33.access-road');
    expect(wide.highRise.maxGfaM2).toBe(50_000);
    expect(wide.highRise.bindingGfaRuleId).toBe('plan.far');
    expect(wide.highRise.gfaLimits.some((l) => l.ruleId === 'mr33.access-road')).toBe(false);
  });

  it('disabling mr33.access-road lifts the block', () => {
    const result = resolve(frontedSite(11.9, 50, 12), { disabledRuleIds: ['mr33.access-road'] });
    expect(result.highRise.available).toBe(true);
    expect(result.highRise.gfaLimits.some((l) => l.ruleId === 'mr33.access-road')).toBe(false);
  });
});

describe('height planes (MR 55 ข้อ 44-46)', () => {
  it('corner plot with 8 m and 20 m roads: planes only from the 20 m road', () => {
    const site = rectSite(50, 50, [road(8, 'soi'), road(20, 'main'), NEIGHBOUR, NEIGHBOUR]);
    const result = resolve(site);
    for (const regime of [result.lowRise, result.highRise]) {
      expect(regime.heightPlanes).toEqual([{ edgeIndex: 1, rowWidthM: 20, slope: 2, ruleId: 'mr55.height-2x' }]);
    }
    // The basis now names the case and the measured length (it used to say the 60 m limits were not checked).
    expect(ruleOf(result.lowRise, 'mr55.height-2x').basis).toContain('meet at a corner of the plot, which runs 50 m along the narrower road');
    expect(result.lowRise.setbacks.map((s) => s.distanceM)).toEqual([2, 2, 3, 3]);
  });

  it('one plane per edge of the governing road', () => {
    const site = rectSite(50, 50, [road(12, 'A'), road(12, 'A'), NEIGHBOUR, NEIGHBOUR]);
    expect(resolve(site).highRise.heightPlanes.map((p) => p.edgeIndex)).toEqual([0, 1]);
  });

  it('two equally wide roads both govern, each along its own edges', () => {
    const site = rectSite(50, 50, [road(12, 'A'), road(12, 'B'), NEIGHBOUR, NEIGHBOUR]);
    const planes = resolve(site).highRise.heightPlanes;
    expect(planes.map((p) => [p.edgeIndex, p.rowWidthM])).toEqual([
      [0, 12],
      [1, 12],
    ]);
  });

  // The plane limits the highest point, the cap the roof deck: compare the plane with 23 m + 3 m parapet.
  const lowRiseHeight: readonly (readonly [string, number, number, number, boolean, boolean])[] = [
    // label, width, depth, ROW, plane binds, cap binds
    ['6 m soi: 2 x (3 + 6) = 18 m at the line; 52 m at the back', 20, 20, 6, true, true],
    ['10 m road: 2 x (2 + 10) = 24 m < 26 m at the line', 50, 50, 10, true, true],
    ['12 m road: 2 x (2 + 12) = 28 m >= 26 m at the line', 20, 20, 12, false, true],
    ['4 m soi, 8 m deep: 16 m at the line, 24 m at the back', 50, 8, 4, true, false],
  ];

  it.each(lowRiseHeight)('low-rise %s', (_label, w, d, row, planeBinds, capBinds) => {
    const result = resolve(frontedSite(w, d, row));
    expect(ruleOf(result.lowRise, 'mr55.height-2x').binding).toBe(planeBinds);
    expect(ruleOf(result.lowRise, 'mr33.highrise-threshold').binding).toBe(capBinds);
  });

  it('high-rise has no cap, so the plane always shapes it', () => {
    const result = resolve(frontedSite(20, 20, 30));
    expect(result.highRise.roofDeckCapM).toBeNull();
    expect(ruleOf(result.highRise, 'mr55.height-2x').binding).toBe(true);
  });
});

/**
 * Golden cases worked out by hand. Defaults as in src/state/defaults.ts: condo floor-to-floor
 * 3.1 m, parking 3.0 m, parapet 1.2 m, 28 m² of parking floor per stall, efficiency 0.7,
 * 35 m² units, 15% of units over 60 m². Office: 3.8 m floors, one stall per 60 m².
 */
import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from './pipeline/test-scenarios';

const SQUARE_EDGES = [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR];

describe('golden case 1: 50 x 50 m condo on a 12 m road, station 300 m', () => {
  const result = expectOk(evaluate(scenario(rect(50, 50), SQUARE_EDGES, { stationDistanceM: 300 })));

  it('measures the plot at 2,500 m²', () => {
    expect(result.site.areaM2).toBeCloseTo(2500, 0);
  });

  it('sets back 2 m from the road and 3 m from neighbours under the low-rise rules', () => {
    // Road: 12 m / 10 = 1.2 m building line, but the 2 m clear space around the building is larger.
    const low = result.regimes.lowRise;
    expect(low.rules.setbacks.map((s) => [s.distanceM, s.ruleId])).toEqual([
      [2, 'bma.clear-space'],
      [3, 'mr55.boundary-openings'],
      [3, 'mr55.boundary-openings'],
      [3, 'mr55.boundary-openings'],
    ]);
    // (50 - 2 - 3) x (50 - 3 - 3) = 45 x 44 = 1,980 m².
    expect(low.envelope?.footprintAreaM2).toBeCloseTo(1980, 0);
  });

  it('sets back 6 m all round under the high-rise rules', () => {
    const high = result.regimes.highRise;
    expect(high.rules.setbacks.every((s) => s.distanceM === 6 && s.ruleId === 'mr33.boundary-6m')).toBe(true);
    // 38 x 38 = 1,444 m².
    expect(high.envelope?.footprintAreaM2).toBeCloseTo(1444, 0);
  });

  it('allows 12,500 m² (FAR 5) under the high-rise rules and 10,000 m² under the low-rise rules', () => {
    expect(result.regimes.highRise.rules.maxGfaM2).toBeCloseTo(12500, 3);
    expect(result.regimes.lowRise.rules.maxGfaM2).toBe(10000);
    expect(result.regimes.highRise.rules.bindingGfaRuleId).toBe('plan.far');
  });

  it('builds a low-rise block just under 10,000 m² and under 23 m', () => {
    // Coverage cap: min(30% open of the plot -> 1,750, 1,923, 2,500 - 6% x 10,000 = 1,900) - 0.5 = 1,749.5.
    // 5 floors x 1,749.5 = 8,747.5, top floor ~1,251 -> ~9,999. Parking: one floor gives
    // floor(1,749.5 / 28) = 62 stalls for ceil(8,249 / 120) = 69 needed, so two floors (124 stalls)
    // for ceil(6,500 / 120) = 55. Heights 3 + 3 + 4 x 3.1: roof deck 18.4 m.
    const low = designById(result, 'low-rise-block');
    expect(low.totals.grossFloorAreaM2).toBeLessThan(10000);
    expect(low.totals.grossFloorAreaM2).toBeGreaterThan(9997);
    expect(low.totals.coverageM2).toBeCloseTo(1749.5, 0);
    expect(low.totals.storeys).toBe(6);
    expect(low.totals.roofDeckHeightM).toBeCloseTo(18.4, 6);
    expect(low.totals.roofDeckHeightM).toBeLessThan(23);
    expect(low.floors.filter((f) => f.use === 'parking')).toHaveLength(2);
    expect([low.totals.parkingRequired, low.totals.parkingProvided]).toEqual([55, 124]);
  });

  it('builds a high-rise that lands within 1 m² of 12,500 m²', () => {
    // 2 parking floors of 1,444 (103 stalls >= ceil(9,612 / 120) = 81), then 6 full floors and a
    // ~948 m² top floor: 9 storeys, roof deck 6 + 7 x 3.1 = 27.7 m. The plane allows
    // 2 x (6 + 12) = 36 m at the front face, above 27.7 + 1.2, so no floor steps back.
    const high = designById(result, 'high-rise-max');
    expect(high.totals.grossFloorAreaM2).toBeLessThanOrEqual(12500);
    expect(high.totals.grossFloorAreaM2).toBeGreaterThan(12499);
    expect(high.totals.storeys).toBe(9);
    expect(high.totals.roofDeckHeightM).toBeCloseTo(27.7, 6);
    expect(high.totals.allowedFar).toBe(5);
  });

  it('adds a slender tower on about half the plate that rises at least 3 storeys higher', () => {
    const high = designById(result, 'high-rise-max');
    const slender = designById(result, 'slender-tower');
    expect(slender.totals.coverageM2 / high.totals.coverageM2).toBeGreaterThan(0.4);
    expect(slender.totals.coverageM2 / high.totals.coverageM2).toBeLessThan(0.55);
    expect(slender.totals.storeys).toBeGreaterThanOrEqual(high.totals.storeys + 3);
    expect(slender.totals.grossFloorAreaM2).toBeCloseTo(high.totals.grossFloorAreaM2, -1);
  });

  it('shows the envelope is mostly empty: floor-area limits bind, not the envelope', () => {
    const high = designById(result, 'high-rise-max');
    expect(high.totals.envelopeVolumeShare).toBeGreaterThan(0);
    expect(high.totals.envelopeVolumeShare).toBeLessThan(0.6);
  });
});

describe('golden case 2: same plot, station 800 m', () => {
  const result = expectOk(evaluate(scenario(rect(50, 50), SQUARE_EDGES, { stationDistanceM: 800 })));

  it('caps the condo at 10,000 m² by the use-size limit', () => {
    // Over 10,000 m² needs a 30 m road or a station within 500 m; neither holds.
    expect(result.regimes.highRise.rules.maxGfaM2).toBe(10000);
    expect(result.regimes.highRise.rules.bindingGfaRuleId).toBe('plan.use-size');
    for (const design of result.designs) expect(design.totals.grossFloorAreaM2).toBeLessThanOrEqual(10000);
  });

  it('drops the squat high-rise (under 23 m and 10,000 m²) but keeps the slender tower', () => {
    expect(result.designs.map((d) => d.id)).toEqual(['low-rise-block', 'slender-tower']);
    expect(designById(result, 'slender-tower').totals.roofDeckHeightM).toBeGreaterThanOrEqual(23);
  });
});

describe('golden case 3: 30 x 40 m condo on a 6 m soi', () => {
  const result = expectOk(evaluate(scenario(rect(30, 40), [road(6), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));

  it('rules out a high-rise: the road is under 10 m', () => {
    expect(result.regimes.highRise.rules.available).toBe(false);
    expect(result.regimes.highRise.rules.blockedBy).toEqual(['mr33.access-road']);
    expect(result.regimes.highRise.envelope).toBeNull();
  });

  it('returns two low-rise designs', () => {
    expect(result.designs.map((d) => [d.id, d.regime])).toEqual([
      ['low-rise-block', 'lowRise'],
      ['low-rise-open', 'lowRise'],
    ]);
  });

  it('steps the top floors back under the 2:1 plane and stops at the 23 m cap', () => {
    // Setback 6 m from the centreline = 3 m; footprint 24 x 34 = 816. Plane 2 x (d + 6).
    // Level 6 top 18.4 + 1.2 = 19.6 needs d >= 3.8: 24 x 33.2 = 796.8.
    // Level 7 top 21.5 + 1.2 = 22.7 needs d >= 5.35: 24 x 31.65 = 759.6.
    // Total 5 x 816 + 796.8 + 759.6 = 5,636.4, short of FAR 5 (6,000): the roof-deck cap binds.
    const low = designById(result, 'low-rise-block');
    expect(low.floors.map((f) => Math.round(f.areaM2 * 10) / 10)).toEqual([816, 816, 816, 816, 816, 796.8, 759.6]);
    expect(low.totals.grossFloorAreaM2).toBeCloseTo(5636.4, 0);
    expect(result.regimes.lowRise.rules.bindingGfaRuleId).toBe('mr33.highrise-threshold');
    expect(low.summary).toContain('stops short');
  });

  it('gives the open-ground variant about 60% of the plate with the same storeys', () => {
    const low = designById(result, 'low-rise-block');
    const open = designById(result, 'low-rise-open');
    expect(open.totals.coverageM2 / low.totals.coverageM2).toBeCloseTo(0.6, 2);
    expect(open.totals.storeys).toBe(low.totals.storeys);
  });
});

describe('golden case 4: office on a 60 x 60 m plot with a 16 m road', () => {
  const result = expectOk(
    evaluate(scenario(rect(60, 60), [road(16), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], { buildingType: 'office' })),
  );

  it('caps operating (main-use) area at 10,000 m² and builds 16,912 m² in all', () => {
    // 48 x 48 = 2,304 plate. 10,000 m² of offices need ceil(10,000 / 60) = 167 stalls;
    // floor(2,304 / 28) = 82 per floor, so 3 parking floors (246). Gross 6,912 + 10,000.
    const high = designById(result, 'high-rise-max');
    expect(result.regimes.highRise.rules.maxMainUseM2).toBe(10000);
    expect(high.totals.mainUseFloorAreaM2).toBeLessThanOrEqual(10000);
    expect(high.totals.mainUseFloorAreaM2).toBeGreaterThan(9999);
    expect(high.totals.parkingFloorAreaM2).toBeCloseTo(6912, 0);
    expect([high.totals.parkingRequired, high.totals.parkingProvided]).toEqual([167, 246]);
    expect(high.floors.every((f) => f.use === 'parking' || f.use === 'office')).toBe(true);
  });

  it('builds the low-rise office on the 10%-open-space plate', () => {
    // 55 x 54 = 2,970, under the 3,000 m² that 6% x 10,000 leaves. Two parking floors.
    const low = designById(result, 'low-rise-block');
    expect(low.totals.coverageM2).toBeCloseTo(2970, 0);
    expect(low.totals.grossFloorAreaM2).toBeLessThan(10000);
    expect(low.totals.storeys).toBe(4);
  });
});

describe('golden case 5: parking counted in FAR or not', () => {
  const counted = expectOk(evaluate(scenario(rect(50, 50), SQUARE_EDGES)));
  const excluded = expectOk(evaluate(scenario(rect(50, 50), SQUARE_EDGES, { parkingCountsInFar: false })));

  it('gives more main-use area when parking is left out of FAR', () => {
    const a = designById(counted, 'high-rise-max').totals;
    const b = designById(excluded, 'high-rise-max').totals;
    expect(b.mainUseFloorAreaM2).toBeGreaterThan(a.mainUseFloorAreaM2 + 2000);
    expect(b.farFloorAreaM2).toBeLessThanOrEqual(12500);
    expect(b.grossFloorAreaM2).toBeGreaterThan(12500);
  });

  it('still keeps the low-rise gross floor area under 10,000 m²', () => {
    expect(designById(excluded, 'low-rise-block').totals.grossFloorAreaM2).toBeLessThan(10000);
  });
});

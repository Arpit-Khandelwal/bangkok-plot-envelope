/** Parking is sized to the requirement: whole floors while needed, then one shared level. */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import type { Design } from '../types';

/** Provided stalls may exceed the requirement by at most this many. */
const MAX_EXTRA_STALLS = 1;

function levels(d: Design): number[] {
  return [...new Set(d.floors.map((f) => f.level))];
}

function expectSizedParking(d: Design): void {
  const { parkingRequired: req, parkingProvided: prov } = d.totals;
  expect(prov).toBeGreaterThanOrEqual(req);
  expect(prov - req).toBeLessThanOrEqual(MAX_EXTRA_STALLS);
}

const condo100 = expectOk(evaluate(scenario(rect(100, 100), [road(30), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
const office80 = expectOk(
  evaluate(scenario(rect(80, 80), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], { buildingType: 'office', stationDistanceM: 2000 })),
);

describe('parking sized to the requirement', () => {
  it.each([
    ['condo rect(100,100), 30 m road', condo100],
    ['office rect(80,80), 12 m road', office80],
  ])('%s: provides the required stalls and at most one more', (_name, e) => {
    expect(e.designs.length).toBeGreaterThan(0);
    for (const d of e.designs) expectSizedParking(d);
  });

  it('carries far more than 2,999 m² of housing on the condo low-rise (was 2,999 m² over 6,999 m² of parking)', () => {
    const low = designById(condo100, 'low-rise-block');
    expect(low.totals.mainUseFloorAreaM2).toBeGreaterThan(8_000);
    expect(low.totals.parkingFloorAreaM2).toBeLessThan(2_000);
  });

  it('splits the last parking level into parking at the back and main use at the road side', () => {
    const low = designById(condo100, 'low-rise-block');
    const shared = levels(low).filter((lv) => low.floors.filter((f) => f.level === lv).length === 2);
    expect(shared).toHaveLength(1);
    const pair = low.floors.filter((f) => f.level === shared[0]);
    const [parking, main] = pair;
    expect(parking?.use).toBe('parking');
    expect(main?.use).toBe('residential');
    expect(parking?.baseM).toBe(main?.baseM);
    expect(parking?.topM).toBe(main?.topM);
    // The road is edge A (y = 0 in drawn coordinates): the main-use part is nearer to it.
    const minY = (f: Design['floors'][number] | undefined): number =>
      Math.min(...(f?.outline ?? []).flatMap((p) => p.outer.map((q) => q.y)));
    expect(minY(main)).toBeLessThan(minY(parking));
  });

  it('counts storeys as distinct levels and sums totals over every entry', () => {
    for (const d of [...condo100.designs, ...office80.designs]) {
      expect(d.totals.storeys).toBe(levels(d).length);
      expect(d.totals.grossFloorAreaM2).toBeCloseTo(d.floors.reduce((s, f) => s + f.areaM2, 0), 9);
      expect(d.passes).toBe(true);
    }
  });
});

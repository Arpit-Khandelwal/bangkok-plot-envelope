/**
 * The plan measures offices by operating area (พื้นที่ประกอบการ), which takes in areas of continuing
 * use; the safe reading counts the office's own parking (research/05-office-hotel-rules.md §2).
 */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import type { ScenarioOptions } from '../pipeline/test-scenarios';

const TOLERANCE_M2 = 1e-6;

function office(w: number, d: number, width: number, options: ScenarioOptions) {
  return expectOk(evaluate(scenario(rect(w, d), [road(width), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], { buildingType: 'office', ...options })));
}

describe('office operating area', () => {
  it('counts parking toward the 1,000 m² cap by default (12 m road, station 2,000 m)', () => {
    const e = office(80, 80, 12, { stationDistanceM: 2000 });
    expect(e.designs.length).toBeGreaterThan(0);
    for (const d of e.designs) {
      expect(d.totals.mainUseFloorAreaM2 + d.totals.parkingFloorAreaM2).toBeLessThanOrEqual(1000 + TOLERANCE_M2);
      expect(d.totals.parkingProvided).toBeGreaterThanOrEqual(d.totals.parkingRequired);
      expect(d.passes).toBe(true);
    }
    const check = designById(e, 'low-rise-block').checks.find((c) => c.ruleId === 'plan.use-size');
    expect(check?.required).toContain('parking');
  });

  it('counts parking toward the 10,000 m² high-rise cap by default (20 m road, station 300 m)', () => {
    const e = office(60, 60, 20, { stationDistanceM: 300 });
    const high = e.designs.filter((d) => d.regime === 'highRise');
    expect(high.length).toBeGreaterThan(0);
    for (const d of high) expect(d.totals.grossFloorAreaM2).toBeLessThanOrEqual(10_000 + TOLERANCE_M2);
  });

  it('with the switch off, counts the office floors only, as before', () => {
    const e = office(80, 80, 12, { stationDistanceM: 2000, officeParkingCountsInOperatingArea: false });
    const low = designById(e, 'low-rise-block');
    expect(low.totals.mainUseFloorAreaM2).toBeGreaterThan(999);
    expect(low.totals.mainUseFloorAreaM2).toBeLessThanOrEqual(1000 + TOLERANCE_M2);
    expect(low.totals.parkingFloorAreaM2).toBeGreaterThan(0);
    const high = office(60, 60, 20, { stationDistanceM: 300, officeParkingCountsInOperatingArea: false });
    expect(designById(high, 'high-rise-max').totals.mainUseFloorAreaM2).toBeGreaterThan(9999);
  });

  it('does not touch a condo', () => {
    const a = expectOk(evaluate(scenario(rect(50, 50), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    const b = expectOk(
      evaluate(scenario(rect(50, 50), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], { officeParkingCountsInOperatingArea: false })),
    );
    expect(a.designs.map((d) => d.totals)).toEqual(b.designs.map((d) => d.totals));
  });
});

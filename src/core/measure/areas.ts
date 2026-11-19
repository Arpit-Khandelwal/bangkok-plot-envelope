/**
 * Floor-area accounting shared by the generator and the checks. These are formulas only: the
 * checks call them on areas they measure from the finished floors themselves.
 *
 * Which floor area each limit counts:
 * - `mainUseFloorArea` limits (the office operating-area test) count the non-parking floors.
 * - The zone plan's FAR (`plan.far`) counts every floor, or only the non-parking floors when the
 *   user chooses `parkingCountsInFar: false`. That setting is a reading of the 2013 plan, so it
 *   applies to the plan's FAR only.
 * - Every other total-floor-area limit counts every floor, parking included: the 10,000 m² high-rise
 *   threshold, the 30,000 m² road-access tier and the high-rise FAR 10 are building-control limits
 *   on the building as built, and the plan's use-size test is read conservatively.
 */
import type { Assumptions, BuildingType, FloorUse, GfaLimit, ParkingRule } from '../types';

/** Exclusive limits ("under 10,000 m²") are met with this much to spare. */
export const EXCLUSIVE_MARGIN_M2 = 1;

export interface AreaSums {
  readonly gross: number;
  readonly parking: number;
  readonly main: number;
}

export const NO_AREA: AreaSums = { gross: 0, parking: 0, main: 0 };

export interface AreaReading {
  /** Ids of the zone plan's FAR rules (see `planFarRuleIds`). */
  readonly planFarRuleIds: ReadonlySet<string>;
  readonly parkingCountsInFar: boolean;
}

export function addFloor(sums: AreaSums, use: FloorUse, areaM2: number): AreaSums {
  const isParking = use === 'parking';
  const parking = sums.parking + (isParking ? areaM2 : 0);
  const main = sums.main + (isParking ? 0 : areaM2);
  return { gross: parking + main, parking, main };
}

/** Whether a floor of this use counts toward this limit. */
export function countsToward(limit: GfaLimit, use: FloorUse, reading: AreaReading): boolean {
  if (use !== 'parking') return true;
  if (limit.measure === 'mainUseFloorArea') return false;
  return reading.parkingCountsInFar || !reading.planFarRuleIds.has(limit.ruleId);
}

/** The floor area this limit is measured against. */
export function measuredArea(limit: GfaLimit, sums: AreaSums, reading: AreaReading): number {
  return countsToward(limit, 'parking', reading) ? sums.gross : sums.main;
}

/** Floor area counted toward FAR under the current reading. */
export function farArea(sums: AreaSums, reading: AreaReading): number {
  return reading.parkingCountsInFar ? sums.gross : sums.main;
}

/** The largest area that meets the limit: the limit itself, or just under it when exclusive. */
export function limitCeiling(limit: GfaLimit): number {
  return limit.exclusive ? limit.limitM2 - EXCLUSIVE_MARGIN_M2 : limit.limitM2;
}

/** True when the measured area meets the limit. */
export function meetsLimit(limit: GfaLimit, measuredM2: number): boolean {
  return limit.exclusive ? measuredM2 < limit.limitM2 : measuredM2 <= limit.limitM2;
}

/** Guard against 0.1 x 30 = 3.0000000000000004 rounding up to 4. */
const CEIL_EPSILON = 1e-9;

function ceilSafe(x: number): number {
  return Math.ceil(x - CEIL_EPSILON);
}

/** Dwelling units (or tenancies for an office) that fit the main-use floor area. */
export function unitsFor(mainUseM2: number, assumptions: Assumptions): number {
  if (!(assumptions.averageUnitM2 > 0)) return 0;
  return Math.max(0, Math.floor((mainUseM2 * assumptions.efficiency) / assumptions.averageUnitM2));
}

export interface ParkingNeed {
  readonly units: number;
  readonly byArea: number;
  readonly byUnits: number;
  readonly required: number;
}

/**
 * Required stalls. Basing the area rate on the main-use floor area (not counting the parking
 * floors themselves) is an assumption: research/01-regulations.md section 5.1 notes the law does
 * not say, and counting only the other floors is the usual practice.
 */
export function parkingNeed(
  mainUseM2: number,
  rule: ParkingRule,
  assumptions: Assumptions,
  buildingType: BuildingType,
): ParkingNeed {
  const units = unitsFor(mainUseM2, assumptions);
  const byArea = Number.isFinite(rule.m2PerStall) && rule.m2PerStall > 0 ? ceilSafe(mainUseM2 / rule.m2PerStall) : 0;
  const perUnit = buildingType === 'condo' && rule.stallsPerLargeUnit > 0;
  const byUnits = perUnit ? ceilSafe(units * assumptions.shareOfUnitsOver60M2 * rule.stallsPerLargeUnit) : 0;
  return { units, byArea, byUnits, required: Math.max(byArea, byUnits) };
}

/** Stalls that fit a parking floor area. */
export function stallsProvided(parkingM2: number, assumptions: Assumptions): number {
  if (!(assumptions.parkingM2PerStall > 0)) return 0;
  return Math.floor(parkingM2 / assumptions.parkingM2PerStall + CEIL_EPSILON);
}

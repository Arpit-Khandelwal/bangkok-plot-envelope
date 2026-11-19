/** Floor height, parking, and the informational checks (EIA, planting, fire road, parking headroom). */
import { regionArea } from '../geom';
import { parkingNeed, stallsProvided } from '../measure/areas';
import { FIRE_ROAD_M, PERMEABLE_SHARE } from '../measure/fire-planting';
import { parkingLevels } from '../measure/levels';
import { floorAreaVs, m, m2, mVs, num } from '../rules/format';
import type { Check } from '../types';
import { isEnabled, makeCheck, titleOf } from './context';
import type { CheckInput, Measured } from './context';
import { requiredOpenSpace } from './geometry';

/** EIA thresholds for a condo (research/01-regulations.md section 5.3). */
export const EIA_UNITS = 80;
export const EIA_USABLE_AREA_M2 = 4_000;
export { FIRE_ROAD_M, PERMEABLE_SHARE };
/** Clear height required under beams in parking areas (MR 41, research/01-regulations.md section 5.1). */
export const PARKING_CLEAR_HEIGHT_M = 2.1;
/** Title of the check, in fire-planting.ts, on whether the fire road and the planting both fit. */
export const FIRE_PLANTING_TITLE = 'Fire road and planting together';
/** Heights are compared to the millimetre. */
const HEIGHT_EPSILON_M = 1e-6;

function floorHeightChecks(input: CheckInput): readonly Check[] {
  const id = 'mr55.floor-height';
  const min = input.regime.minFloorToFloorM;
  const main = input.floors.filter((f) => f.use !== 'parking');
  if (!isEnabled(input, id) || main.length === 0) return [];
  const lowest = Math.min(...main.map((f) => f.topM - f.baseM));
  const entered = input.enteredFloorToFloorM;
  const overridden = Number.isFinite(entered) && entered < min;
  const ok = lowest >= min - HEIGHT_EPSILON_M;
  const shown = mVs(lowest, min);
  const enteredShown = mVs(entered, min);
  return [
    makeCheck(input, {
      ruleId: id,
      title: titleOf(input, id, 'Minimum floor-to-floor height'),
      status: !ok ? 'fail' : overridden ? 'warn' : 'pass',
      required: `Floor to floor at least ${shown.limit}.`,
      actual: overridden
        ? `Your assumed ${enteredShown.value} is below the legal minimum, so the design uses ${shown.value}.`
        : `${shown.value} on the ${main.length} main-use floors.`,
    }),
  ];
}

function parkingChecks(input: CheckInput, measured: Measured): readonly Check[] {
  const rule = input.regime.parking;
  if (rule.ruleId === null || !isEnabled(input, rule.ruleId)) return [];
  const need = parkingNeed(measured.sums.main, rule, input.assumptions, input.buildingType);
  const provided = stallsProvided(measured.sums.parking, input.assumptions);
  const levels = parkingLevels(input.floors);
  const sharedText = levels.shared === 0 ? '' : `, ${levels.shared} of them shared with main use`;
  const perUnit = need.byUnits > 0 ? `, or ${num(need.byUnits)} for the units of 60 m² or more, whichever is more` : '';
  return [
    makeCheck(input, {
      ruleId: rule.ruleId,
      title: titleOf(input, rule.ruleId, 'Car parking'),
      status: provided >= need.required ? 'pass' : 'fail',
      required: `At least ${num(need.required)} spaces: ${num(need.byArea)} at one per ${m2(rule.m2PerStall)} of main-use floor area (${m2(measured.sums.main)})${perUnit}.`,
      actual: `${num(provided)} spaces on ${levels.count} parking level${levels.count === 1 ? '' : 's'}${sharedText} (${m2(measured.sums.parking)} at ${m2(input.assumptions.parkingM2PerStall)} per space).`,
    }),
  ];
}

/**
 * The EIA note. The threshold is "usable area" (พื้นที่ใช้สอย), whose definition was not verified, so
 * the strictest measure is used: the total floor area of the building, parking included, with no
 * efficiency discount.
 */
function eiaCheck(input: CheckInput, measured: Measured): readonly Check[] {
  const id = 'eia.threshold';
  if (input.buildingType !== 'condo' || !isEnabled(input, id)) return [];
  const need = parkingNeed(measured.sums.main, input.regime.parking, input.assumptions, input.buildingType);
  const area = measured.sums.gross;
  const needed = need.units >= EIA_UNITS || area >= EIA_USABLE_AREA_M2;
  const shown = floorAreaVs(area, EIA_USABLE_AREA_M2);
  return [
    makeCheck(input, {
      ruleId: id,
      title: titleOf(input, id, 'Environmental impact assessment'),
      status: 'info',
      required: `Needed at ${EIA_UNITS} units or more, or ${shown.limit} or more of usable area. Usable area is taken as the total floor area of the building, the strictest measure, until its definition is confirmed.`,
      actual: `${num(need.units)} units and ${shown.value} of total floor area: ${needed ? 'an EIA is needed' : 'no EIA needed'}.`,
    }),
  ];
}

/** MR 41's clear height in car parks, which the tool cannot see: the assumed storey height is stated. */
function parkingHeadroomCheck(input: CheckInput): readonly Check[] {
  const rule = input.regime.parking;
  const parking = input.floors.filter((f) => f.use === 'parking');
  if (rule.ruleId === null || !isEnabled(input, rule.ruleId) || parking.length === 0) return [];
  const storey = Math.min(...parking.map((f) => f.topM - f.baseM));
  return [
    makeCheck(input, {
      ruleId: rule.ruleId,
      title: 'Parking clear height',
      status: 'info',
      required: `At least ${m(PARKING_CLEAR_HEIGHT_M)} clear under beams and services in the parking areas, aisles and ramps (MR 41 ข้อ 4).`,
      actual: `The parking floors are assumed ${m(storey)} floor to floor; the ${m(PARKING_CLEAR_HEIGHT_M)} clear under beams must be achieved in the structural design.`,
    }),
  ];
}

function permeableCheck(input: CheckInput, measured: Measured): readonly Check[] {
  const id = 'plan.permeable';
  if (!isEnabled(input, id) || input.regime.openSpace.length === 0) return [];
  const required = Math.max(...input.regime.openSpace.map((r) => requiredOpenSpace(r, input, measured)));
  const open = input.site.areaM2 - measured.coverageM2;
  return [
    makeCheck(input, {
      ruleId: id,
      title: titleOf(input, id, 'Permeable planting area'),
      status: 'info',
      required: `At least ${m2(required * PERMEABLE_SHARE)} of permeable planting: half of the ${m2(required)} of open space required.`,
      actual: `${m2(open)} of open ground is left; plan at least ${m2(required * PERMEABLE_SHARE)} of it as planting.`,
    }),
  ];
}

const BOUNDARY_SETBACK_RULE = 'mr33.boundary-6m';

/**
 * What the envelope says about room for the fire road: the high-rise setback is 6 m on every
 * boundary (MR 33 ข้อ 4), which leaves room for it, unless that rule is switched off.
 */
function roomForFireRoad(input: CheckInput): string {
  if (isEnabled(input, BOUNDARY_SETBACK_RULE)) return `The ${m(FIRE_ROAD_M)} setback leaves room for it on every side; the tool does not lay it out.`;
  return `With the ${m(FIRE_ROAD_M)} setback switched off, the tool cannot say there is room for it; it does not lay it out.`;
}

function fireRoadCheck(input: CheckInput, measured: Measured): readonly Check[] {
  const id = 'mr33.fire-road';
  if (input.regime.regime !== 'highRise' || !isEnabled(input, id)) return [];
  const ground = regionArea(measured.footprint);
  return [
    makeCheck(input, {
      ruleId: id,
      title: titleOf(input, id, 'Fire-truck access'),
      status: 'info',
      required: `A ${m(FIRE_ROAD_M)} wide fire road must run all around the building, open to the sky.`,
      actual: `${roomForFireRoad(input)} Whether the planting also fits beside it around the ${m2(ground)} footprint is checked under “${FIRE_PLANTING_TITLE}”.`,
    }),
  ];
}

export function buildingChecks(input: CheckInput, measured: Measured): readonly Check[] {
  return [
    ...floorHeightChecks(input),
    ...parkingChecks(input, measured),
    ...parkingHeadroomCheck(input),
    ...eiaCheck(input, measured),
    ...permeableCheck(input, measured),
    ...fireRoadCheck(input, measured),
  ];
}

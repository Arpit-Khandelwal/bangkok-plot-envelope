/** Floor height, parking, and the informational checks (EIA, planting, fire road). */
import { regionArea } from '../geom';
import { parkingNeed, stallsProvided } from '../measure/areas';
import { m, m2, num } from '../rules/format';
import type { Check } from '../types';
import { isEnabled, makeCheck, titleOf } from './context';
import type { CheckInput, Measured } from './context';
import { requiredOpenSpace } from './geometry';

/** EIA thresholds for a condo (research/01-regulations.md section 5.3). */
export const EIA_UNITS = 80;
export const EIA_USABLE_AREA_M2 = 4_000;
/** Share of the open space that must be permeable planting (plan clause 14(2)). */
export const PERMEABLE_SHARE = 0.5;
/** Width of the fire-truck road around a high-rise (MR 33 ข้อ 3). */
export const FIRE_ROAD_M = 6;
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
  return [
    makeCheck(input, {
      ruleId: id,
      title: titleOf(input, id, 'Minimum floor-to-floor height'),
      status: !ok ? 'fail' : overridden ? 'warn' : 'pass',
      required: `Floor to floor at least ${m(min)}.`,
      actual: overridden
        ? `Your assumed ${m(entered)} is below the legal minimum, so the design uses ${m(lowest)}.`
        : `${m(lowest)} on the ${main.length} main-use floors.`,
    }),
  ];
}

function parkingChecks(input: CheckInput, measured: Measured): readonly Check[] {
  const rule = input.regime.parking;
  if (rule.ruleId === null || !isEnabled(input, rule.ruleId)) return [];
  const need = parkingNeed(measured.sums.main, rule, input.assumptions, input.buildingType);
  const provided = stallsProvided(measured.sums.parking, input.assumptions);
  const parkingFloors = input.floors.filter((f) => f.use === 'parking').length;
  const perUnit = need.byUnits > 0 ? `, or ${num(need.byUnits)} for the units of 60 m² or more` : '';
  return [
    makeCheck(input, {
      ruleId: rule.ruleId,
      title: titleOf(input, rule.ruleId, 'Car parking'),
      status: provided >= need.required ? 'pass' : 'fail',
      required: `At least ${num(need.required)} spaces: ${num(need.byArea)} at one per ${m2(rule.m2PerStall)} of main-use floor area (${m2(measured.sums.main)})${perUnit}, whichever is more.`,
      actual: `${num(provided)} spaces on ${parkingFloors} parking floor${parkingFloors === 1 ? '' : 's'} (${m2(measured.sums.parking)} at ${m2(input.assumptions.parkingM2PerStall)} per space).`,
    }),
  ];
}

function eiaCheck(input: CheckInput, measured: Measured): readonly Check[] {
  const id = 'eia.threshold';
  if (input.buildingType !== 'condo' || !isEnabled(input, id)) return [];
  const need = parkingNeed(measured.sums.main, input.regime.parking, input.assumptions, input.buildingType);
  const usable = measured.sums.main * input.assumptions.efficiency;
  const needed = need.units >= EIA_UNITS || usable >= EIA_USABLE_AREA_M2;
  return [
    makeCheck(input, {
      ruleId: id,
      title: titleOf(input, id, 'Environmental impact assessment'),
      status: 'info',
      required: `Needed at ${EIA_UNITS} units or more, or ${m2(EIA_USABLE_AREA_M2)} or more of usable area.`,
      actual: `${num(need.units)} units and ${m2(usable)} usable: ${needed ? 'an EIA is needed' : 'no EIA needed'}.`,
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

function fireRoadCheck(input: CheckInput, measured: Measured): readonly Check[] {
  const id = 'mr33.fire-road';
  if (input.regime.regime !== 'highRise' || !isEnabled(input, id)) return [];
  const ground = regionArea(measured.footprint);
  return [
    makeCheck(input, {
      ruleId: id,
      title: titleOf(input, id, 'Fire-truck access'),
      status: 'info',
      required: `A ${m(FIRE_ROAD_M)} fire-truck road, open to the sky, all around the building.`,
      actual: `It lies within the ${m(FIRE_ROAD_M)} setback strip around the ${m2(ground)} footprint; keep that strip clear in the site plan.`,
    }),
  ];
}

export function buildingChecks(input: CheckInput, measured: Measured): readonly Check[] {
  return [
    ...floorHeightChecks(input),
    ...parkingChecks(input, measured),
    ...eiaCheck(input, measured),
    ...permeableCheck(input, measured),
    ...fireRoadCheck(input, measured),
  ];
}

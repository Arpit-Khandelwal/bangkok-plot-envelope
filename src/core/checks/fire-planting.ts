/**
 * Whether the 6 m fire road all around a high-rise (MR 33 ข้อ 3) and the permeable planting
 * (plan ข้อ 14(2), half the required open space) can both fit on the open ground. Measured by area
 * only (`fireRoadGround`): the open ground left after a 6 m ring around the building's ground
 * coverage, clipped to the plot, must be at least the planting area. Both are legal requirements,
 * so this passes or fails; the layout itself is not drawn.
 */
import { fireRoadGround, FIRE_ROAD_M, FIRE_ROAD_RULE, PERMEABLE_RULE, plantingRequiredM2 } from '../measure/fire-planting';
import { m, m2, m2Vs } from '../rules/format';
import type { Check } from '../types';
import { FIRE_PLANTING_TITLE } from './building';
import { isEnabled, makeCheck, passFail } from './context';
import type { CheckInput, Measured } from './context';

export { FIRE_PLANTING_TITLE };

export function firePlantingChecks(input: CheckInput, measured: Measured): readonly Check[] {
  const applies = input.regime.regime === 'highRise' && isEnabled(input, FIRE_ROAD_RULE) && isEnabled(input, PERMEABLE_RULE);
  if (!applies || input.regime.openSpace.length === 0 || measured.footprint.length === 0) return [];
  const basis = { plotM2: input.site.areaM2, grossM2: measured.sums.gross, largestFloorM2: measured.largestFloorM2 };
  const planting = plantingRequiredM2(input.regime.openSpace, basis);
  const ground = fireRoadGround(input.site, measured.footprint);
  const shown = m2Vs(ground.leftM2, planting);
  const fits = ground.leftM2 >= planting;
  return [
    makeCheck(input, {
      ruleId: FIRE_ROAD_RULE,
      title: FIRE_PLANTING_TITLE,
      status: passFail(fits),
      required: `Room for a ${m(FIRE_ROAD_M)} fire-truck road all around the building and, besides it, at least ${shown.limit} of permeable planting (half the open space required).`,
      actual: fits
        ? `${m2(ground.openM2)} of open ground, of which a ${m(FIRE_ROAD_M)} ring around the building takes ${m2(ground.ringM2)}: ${shown.value} is left for planting, by area. The layout itself is not drawn; check it in the site plan.`
        : `The ${m(FIRE_ROAD_M)} ring around the building takes ${m2(ground.ringM2)} of the ${m2(ground.openM2)} of open ground, leaving ${shown.value}, less than the ${shown.limit} of planting required: the fire road and the planting cannot both fit as designed.`,
    }),
  ];
}

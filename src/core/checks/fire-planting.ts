/**
 * Whether the 6 m fire road all around a high-rise (MR 33 ข้อ 3) and the permeable planting
 * (plan ข้อ 14(2), half the required open space) can both fit on the open ground. Measured by area
 * only: the open ground left after a 6 m ring around the building's ground coverage, clipped to the
 * plot, must be at least the planting area. It is a warning when it is not, never a failure, since
 * the tool does not lay out the site.
 */
import { difference, growUniform, intersection, regionArea } from '../geom';
import { m, m2, m2Vs } from '../rules/format';
import type { Check, Region } from '../types';
import { FIRE_PLANTING_TITLE, FIRE_ROAD_M, PERMEABLE_SHARE } from './building';
import { isEnabled, makeCheck } from './context';
import type { CheckInput, Measured } from './context';
import { requiredOpenSpace } from './geometry';

const FIRE_RULE = 'mr33.fire-road';
const PERMEABLE_RULE = 'plan.permeable';
export { FIRE_PLANTING_TITLE };

function fireRing(input: CheckInput, footprint: Region): number {
  const plot: Region = [{ outer: input.site.ring, holes: [] }];
  return regionArea(intersection(difference(growUniform(footprint, FIRE_ROAD_M), footprint), plot));
}

export function firePlantingChecks(input: CheckInput, measured: Measured): readonly Check[] {
  const applies = input.regime.regime === 'highRise' && isEnabled(input, FIRE_RULE) && isEnabled(input, PERMEABLE_RULE);
  if (!applies || input.regime.openSpace.length === 0 || measured.footprint.length === 0) return [];
  const requiredOpen = Math.max(...input.regime.openSpace.map((r) => requiredOpenSpace(r, input, measured)));
  const planting = requiredOpen * PERMEABLE_SHARE;
  const open = input.site.areaM2 - measured.coverageM2;
  const ring = Math.min(open, fireRing(input, measured.footprint));
  const left = open - ring;
  const shown = m2Vs(left, planting);
  const fits = left >= planting;
  return [
    makeCheck(input, {
      ruleId: FIRE_RULE,
      title: FIRE_PLANTING_TITLE,
      status: fits ? 'info' : 'warn',
      required: `Room for a ${m(FIRE_ROAD_M)} fire-truck road all around the building and, besides it, at least ${shown.limit} of permeable planting (half the open space required).`,
      actual: fits
        ? `${m2(open)} of open ground, of which a ${m(FIRE_ROAD_M)} ring around the building takes ${m2(ring)}: ${shown.value} is left for planting, by area. Check the layout in the site plan.`
        : `The ${m(FIRE_ROAD_M)} ring around the building takes ${m2(ring)} of the ${m2(open)} of open ground, leaving ${shown.value}, less than the ${shown.limit} of planting required: the fire road and the planting cannot both fit as designed.`,
    }),
  ];
}

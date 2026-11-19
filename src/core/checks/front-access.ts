/**
 * Front access, Bangkok ordinance B.E. 2544 ข้อ 52(6) and ข้อ 53 (DECISIONS.md B12), judged by the
 * clause that governs the building (`frontVerdict`): pass or fail on the measured geometry, with
 * the reading applied stated in the requirement.
 */
import { frontVerdict } from '../designs/front-rule';
import { FRONT_FACADE_MAX_M, FRONT_FACADE_SHARE } from '../measure/front-access';
import type { FrontAccess } from '../measure/front-access';
import { INTERNAL_ROAD_M } from '../measure/front-open-space';
import type { FrontOpenSpace } from '../measure/front-open-space';
import { levelCount } from '../measure/levels';
import { m, mVs } from '../rules/format';
import type { Check } from '../types';
import { isEnabled, makeCheck, passFail, titleOf } from './context';
import type { CheckInput, Measured } from './context';

const RULE = 'bma.front-access';

export const ON_ROAD_FORM = 'Form: on the road.';
export const DEFAULT_READING =
  'Read as: the front open space in clause 52(6) is for buildings not on a public road; a building on a public road must face it with more than one eighth of its perimeter (clause 53). A stricter reading is available in the settings.';
export const STRICT_READING =
  'Read as (your setting): the front open space in clause 52(6) is required of every building it lists, on a public road or not; clause 53 covers only the others.';
export const OFF_ROAD_READING =
  'Form: set back. The building stands more than 20 m from the public road, so it is not on it in the sense of clause 53 (whose road-side building line must be within 20 m), and clause 52(6) applies on either reading.';

function clause53Text(fa: FrontAccess, reading: string): { readonly required: string; readonly actual: string } {
  const needed = FRONT_FACADE_SHARE * fa.perimeterM;
  const near = mVs(fa.nearestM, FRONT_FACADE_MAX_M);
  const facing = mVs(fa.facingM, needed);
  return {
    required: `${reading} Clause 53: the building line on the road side longer than ${facing.limit} (one eighth of the ${m(fa.perimeterM)} external perimeter) and no more than ${near.limit} from the road.`,
    actual: `The building comes ${near.value} from the road and has ${facing.value} of façade facing it within ${near.limit}.`,
  };
}

function clause52Text(os: FrontOpenSpace, reading: string): { readonly required: string; readonly actual: string } {
  const run = mVs(os.runM, os.neededM);
  const actual = os.meets
    ? `${run.value} of the outline has ${m(os.widthM)} of open ground in front of it, linked to the road.`
    : os.runM >= os.neededM
      ? `${run.value} of the outline has ${m(os.widthM)} of open ground in front of it, but it does not reach the road through open ground ${m(INTERNAL_ROAD_M)} wide.`
      : `Only ${run.value} of the outline has ${m(os.widthM)} of open ground in front of it.`;
  return {
    required: `${reading} Clause 52(6): a front open space at least ${m(os.widthM)} wide, continuous along at least ${run.limit} of the building (one sixth of the ${m(os.perimeterM)} external perimeter, side open space joined to it included), linked to the road through open ground at least ${m(INTERNAL_ROAD_M)} wide.`,
    actual: `${actual} The open space and its link are measured on the outline, not laid out.`,
  };
}

export function frontAccessChecks(input: CheckInput, measured: Measured): readonly Check[] {
  if (!isEnabled(input, RULE) || measured.footprint.length === 0) return [];
  const strict = input.frontOpenSpaceOnPublicRoad;
  const verdict = frontVerdict(
    { site: input.site, regime: input.regime, strict, buildingType: input.buildingType, storeys: levelCount(input.floors), heightM: measured.roofDeckM },
    measured.footprint,
  );
  const reading = !verdict.onRoad ? OFF_ROAD_READING : `${ON_ROAD_FORM} ${strict ? STRICT_READING : DEFAULT_READING}`;
  const text =
    verdict.clause === 'clause53'
      ? clause53Text(verdict.fa, reading)
      : verdict.clause === 'clause52'
        ? clause52Text(verdict.os, reading)
        : {
            required: `${OFF_ROAD_READING} Clause 52(6) exempts a residential building of at most 3 storeys away from a public road.`,
            actual: 'No front open space is required of this building.',
          };
  return [
    makeCheck(input, {
      ruleId: RULE,
      title: titleOf(input, RULE, 'Front open space or road-facing façade'),
      status: passFail(verdict.met),
      required: text.required,
      actual: text.actual,
    }),
  ];
}

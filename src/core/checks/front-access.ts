/**
 * Front open space, Bangkok ordinance B.E. 2544 ข้อ 52(6) and ข้อ 53 (research/01-regulations.md §3.4).
 * Pass when the design meets ข้อ 53, with both measured values; otherwise a warning that the ข้อ 52(6)
 * open space is needed, which the tool does not lay out. Never a failure, since that route is not checked.
 */
import { FRONT_FACADE_MAX_M, FRONT_FACADE_SHARE, frontAccess, meetsClause53 } from '../measure/front-access';
import { mVs } from '../rules/format';
import type { Check } from '../types';
import { isEnabled, makeCheck, titleOf } from './context';
import type { CheckInput, Measured } from './context';

const RULE = 'bma.front-access';

export const FRONT_OPEN_SPACE_WARNING =
  'This design needs a front open space at least 12 m wide along at least one sixth of its perimeter, linked to the road by a 6 m internal road (Bangkok ordinance clause 52(6)). The tool does not lay this out.';

export function frontAccessChecks(input: CheckInput, measured: Measured): readonly Check[] {
  if (!isEnabled(input, RULE) || measured.footprint.length === 0) return [];
  const m = frontAccess(input.site, measured.footprint);
  const needed = FRONT_FACADE_SHARE * m.perimeterM;
  const near = mVs(m.nearestM, FRONT_FACADE_MAX_M);
  const facing = mVs(m.facingM, needed);
  const ok = meetsClause53(m);
  return [
    makeCheck(input, {
      ruleId: RULE,
      title: titleOf(input, RULE, 'Front open space or road-facing façade'),
      status: ok ? 'pass' : 'warn',
      required: `Clause 53: some of the building within ${near.limit} of the road, and more than ${facing.limit} of façade facing it (one eighth of the ${mVs(m.perimeterM, needed).value} external perimeter). Otherwise the clause 52(6) front open space.`,
      actual: ok
        ? `The building comes ${near.value} from the road and has ${facing.value} of façade facing it within ${near.limit}.`
        : FRONT_OPEN_SPACE_WARNING,
    }),
  ];
}

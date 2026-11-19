/** Floor-area limits and the low-rise thresholds. */
import { measuredArea, meetsLimit } from '../measure/areas';
import { m, m2, num } from '../rules/format';
import type { Check, GfaLimit } from '../types';
import { isEnabled, makeCheck, passFail, titleOf } from './context';
import type { CheckInput, Measured } from './context';

/** Roof-deck height at which a building is high-rise (MR 33 ข้อ 1). Used only to classify. */
export const HIGH_RISE_ROOF_DECK_M = 23;
/** Floor area at which a building is extra-large (MR 33 ข้อ 1). Used only to classify. */
export const EXTRA_LARGE_M2 = 10_000;
const THRESHOLD_RULE = 'mr33.highrise-threshold';

function measureLabel(input: CheckInput, limit: GfaLimit): string {
  if (limit.measure === 'mainUseFloorArea') return 'Main-use (operating) floor area';
  if (input.reading.planFarRuleIds.has(limit.ruleId) && !input.reading.parkingCountsInFar) {
    return 'Floor area counted toward FAR (parking floors left out, by your setting)';
  }
  return 'Total floor area, every floor including parking';
}

function limitCheck(input: CheckInput, measured: Measured, limit: GfaLimit): Check {
  const area = measuredArea(limit, measured.sums, input.reading);
  const bound = limit.exclusive ? `under ${m2(limit.limitM2)}` : `at most ${m2(limit.limitM2)}`;
  const far = input.reading.planFarRuleIds.has(limit.ruleId) ? ` (FAR ${num(area / input.site.areaM2)})` : '';
  return makeCheck(input, {
    ruleId: limit.ruleId,
    title: titleOf(input, limit.ruleId, 'Floor-area limit'),
    status: passFail(meetsLimit(limit, area)),
    required: `${measureLabel(input, limit)} ${bound}.`,
    actual: `${m2(area)}${far}.`,
  });
}

/** When the use-size test sets no number (a qualifying road or station), say so. */
function unlimitedUseSize(input: CheckInput, measured: Measured): readonly Check[] {
  const id = 'plan.use-size';
  const rule = input.regime.rules.find((r) => r.id === id && !r.disabled);
  if (rule === undefined || input.regime.gfaLimits.some((l) => l.ruleId === id)) return [];
  return [
    makeCheck(input, {
      ruleId: id,
      title: rule.title,
      status: 'pass',
      required: rule.requirement,
      actual: `${m2(measured.sums.gross)} of total floor area; no use-size limit applies here.`,
    }),
  ];
}

/** Low-rise: roof deck and every single floor stay under the high-rise thresholds. */
function lowRiseThreshold(input: CheckInput, measured: Measured): readonly Check[] {
  const cap = input.regime.roofDeckCapM;
  if (input.regime.regime !== 'lowRise' || !isEnabled(input, THRESHOLD_RULE)) return [];
  const floorLimit = input.regime.gfaLimits.find((l) => l.ruleId === THRESHOLD_RULE && l.exclusive);
  const top = measured.roofDeckM + input.assumptions.parapetM;
  const checks: Check[] = [];
  if (cap !== null) {
    checks.push(
      makeCheck(input, {
        ruleId: THRESHOLD_RULE,
        title: 'Roof deck under the high-rise height',
        status: passFail(measured.roofDeckM < cap),
        required: `Roof deck below ${m(cap)}, measured from the ground to the roof-deck floor.`,
        actual: `Roof deck at ${m(measured.roofDeckM)}; parapet top at ${m(top)} (not counted here).`,
      }),
    );
  }
  if (floorLimit !== undefined) {
    checks.push(
      makeCheck(input, {
        ruleId: THRESHOLD_RULE,
        title: 'No single floor at the extra-large size',
        status: passFail(measured.largestFloorM2 < floorLimit.limitM2),
        required: `Every single floor under ${m2(floorLimit.limitM2)}.`,
        actual: `Largest floor ${m2(measured.largestFloorM2)}.`,
      }),
    );
  }
  return checks;
}

/** High-rise: the roof-deck height, for information. */
function highRiseHeight(input: CheckInput, measured: Measured): readonly Check[] {
  if (input.regime.regime !== 'highRise' || input.disabledRuleIds.has(THRESHOLD_RULE)) return [];
  const isHigh = measured.roofDeckM >= HIGH_RISE_ROOF_DECK_M;
  return [
    makeCheck(input, {
      ruleId: THRESHOLD_RULE,
      title: 'High-rise classification',
      status: 'info',
      required: `A roof deck at ${m(HIGH_RISE_ROOF_DECK_M)} or more, or ${m2(EXTRA_LARGE_M2)} or more of floor area, makes the building high-rise or extra-large.`,
      actual: `Roof deck at ${m(measured.roofDeckM)} and ${m2(measured.sums.gross)} of floor area: ${isHigh ? 'a high-rise' : 'below the height threshold'}, assessed under the high-rise rules.`,
    }),
  ];
}

export function areaChecks(input: CheckInput, measured: Measured): readonly Check[] {
  return [
    ...input.regime.gfaLimits.map((limit) => limitCheck(input, measured, limit)),
    ...unlimitedUseSize(input, measured),
    ...lowRiseThreshold(input, measured),
    ...highRiseHeight(input, measured),
  ];
}

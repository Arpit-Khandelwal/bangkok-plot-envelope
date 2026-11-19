/**
 * Which rule really limits a regime's floor area, once the largest design is known. The resolver
 * guesses from the numbers alone (the strictest floor-area limit); the geometry can bind first,
 * for example when the height plane or the roof-deck cap stops the floors short of FAR.
 */
import type { StopReason } from '../designs/stack';
import { limitCeiling, measuredArea } from '../measure/areas';
import type { AreaReading, AreaSums } from '../measure/areas';
import type { RegimeRules } from '../types';

/** A design within this of its ceiling has reached the floor-area limit. */
const AT_LIMIT_M2 = 2;

export interface LargestDesign {
  readonly stop: StopReason;
  readonly sums: AreaSums;
}

function bindingId(rules: RegimeRules, largest: LargestDesign, reading: AreaReading): string | null {
  const { stop } = largest;
  if (stop.kind === 'limit') return stop.ruleId;
  const reached = rules.gfaLimits.find(
    (l) => measuredArea(l, largest.sums, reading) >= limitCeiling(l) - AT_LIMIT_M2,
  );
  if (reached !== undefined) return reached.ruleId;
  return stop.ruleId;
}

export function withActualBinding(rules: RegimeRules, largest: LargestDesign | null, reading: AreaReading): RegimeRules {
  if (largest === null) return rules;
  const actual = bindingId(rules, largest, reading);
  if (actual === null) return rules;
  const areaRuleIds = new Set(rules.gfaLimits.map((l) => l.ruleId));
  return {
    ...rules,
    bindingGfaRuleId: actual,
    rules: rules.rules.map((r) => {
      if (r.disabled) return r;
      if (r.id === actual) return { ...r, binding: true };
      return areaRuleIds.has(r.id) ? { ...r, binding: false } : r;
    }),
  };
}

/** One-line summaries that say what distinguishes each design, with its headline numbers. */
import { limitCeiling, measuredArea } from '../measure/areas';
import type { AreaReading, AreaSums } from '../measure/areas';
import { m, m2, mVs, pct } from '../rules/format';
import type { Design, RegimeRules } from '../types';
import type { StopReason } from './stack';

type Draft = Omit<Design, 'summary'>;

/** A design within this of its floor-area ceiling has reached it. */
const AT_LIMIT_M2 = 2;

/** Storeys, floor area and roof deck; the deck is shown so it never contradicts `capM`. */
function headline(d: Draft, capM: number | null = null): string {
  const t = d.totals;
  const deck = capM === null ? m(t.roofDeckHeightM) : mVs(t.roofDeckHeightM, capM).value;
  return `${t.storeys} storeys, ${m2(t.grossFloorAreaM2)} of floor area, roof deck at ${deck}`;
}

function ruleTitle(regime: RegimeRules, ruleId: string | null): string {
  if (ruleId === null) return 'the height cap';
  const rule = regime.rules.find((r) => r.id === ruleId);
  return rule === undefined ? ruleId : `the ${rule.title.toLowerCase()}`;
}

/** True when the design has reached one of the floor-area limits, each on its own measure. */
function reachesALimit(d: Draft, regime: RegimeRules, reading: AreaReading): boolean {
  const sums = { gross: d.totals.grossFloorAreaM2, parking: d.totals.parkingFloorAreaM2, main: d.totals.mainUseFloorAreaM2 };
  return regime.gfaLimits.some((l) => measuredArea(l, sums, reading) >= limitCeiling(l) - AT_LIMIT_M2);
}

/** What ends a low-rise stack at the roof-deck cap: the lighter rules hold only below both thresholds. */
function lowRiseCapCause(regime: RegimeRules, capM: number): string {
  const sizeLimit = regime.gfaLimits.find((l) => l.exclusive);
  const bounds = sizeLimit === undefined ? m(capM) : `${m(capM)} and ${m2(sizeLimit.limitM2)}`;
  return `to stay under ${bounds}, which keeps the lighter low-rise rules; a high-rise is the way to build more`;
}

/** " It stops short of ..." when geometry, not a floor-area limit, ends the stack. */
export function shortfallNote(d: Draft, regime: RegimeRules, stop: StopReason, reading: AreaReading): string {
  if (stop.kind === 'limit') return '';
  if (regime.gfaLimits.length === 0 || reachesALimit(d, regime, reading)) return '';
  const lead = ` It stops short of the ${m2(regime.maxGfaM2)} floor-area limit`;
  if (stop.kind === 'cap' && regime.regime === 'lowRise' && regime.roofDeckCapM !== null) {
    return `${lead} ${lowRiseCapCause(regime, regime.roofDeckCapM)}.`;
  }
  const cause = stop.kind === 'storeys' ? 'the storey cap of this tool' : ruleTitle(regime, stop.ruleId);
  return `${lead} because of ${cause}.`;
}

export function lowRiseSummary(d: Draft, regime: RegimeRules, stop: StopReason, reading: AreaReading): string {
  const cap = regime.roofDeckCapM;
  const lead = cap === null ? 'Built under the low-rise rules' : `Keeps the roof deck under ${m(cap)} so the lighter low-rise rules apply`;
  return `${lead}: ${headline(d, cap)}.${shortfallNote(d, regime, stop, reading)}`;
}

export function highRiseSummary(d: Draft, regime: RegimeRules, stop: StopReason, reading: AreaReading): string {
  return `Goes high-rise to use the most floor area: ${headline(d)}, on a ${m2(d.totals.coverageM2)} footprint.${shortfallNote(d, regime, stop, reading)}`;
}

/** Compares the slender tower's floor area with the high-rise it is derived from, honestly. */
function comparedWith(d: Draft, target: AreaSums): string {
  const gap = target.gross - d.totals.grossFloorAreaM2;
  if (gap <= AT_LIMIT_M2) return 'The same floor area as the high-rise';
  if (target.main - d.totals.mainUseFloorAreaM2 <= AT_LIMIT_M2) {
    return `The same main-use area as the high-rise but ${m2(gap)} less in all, as its smaller parking floors leave less spare area,`;
  }
  return `${m2(gap)} less floor area than the high-rise`;
}

export function slenderSummary(
  d: Draft,
  regime: RegimeRules,
  stop: StopReason,
  share: number,
  target: AreaSums,
  reading: AreaReading,
): string {
  return `${comparedWith(d, target)} on a plate ${pct(share)} the size, so it rises higher and leaves ${m2(d.totals.openSpaceM2)} of open ground: ${headline(d)}.${shortfallNote(d, regime, stop, reading)}`;
}

export function openGroundSummary(d: Draft, share: number): string {
  return `A smaller plate, ${pct(share)} of the largest, for more open ground (${m2(d.totals.openSpaceM2)}): ${headline(d)}.`;
}

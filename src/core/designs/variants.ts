/**
 * The concept designs. (a) a low-rise block; (b) a high-rise using the most floor area, kept only
 * when it is genuinely high-rise or extra-large; (c) a slender tower with the same floor-area
 * target on about half the plate, kept when it gains at least three storeys on (b); and, while
 * fewer than two designs remain, smaller-plate "more open ground" variants of whichever regime
 * has an envelope. A design that fails its own checks is never returned unless rules are off.
 * The slender tower slides toward the road when that meets the ordinance's road-facing façade rule.
 */
import { regionArea } from '../geom';
import type { Design, RegimeId } from '../types';
import type { CheckBase } from './assemble';
import { assembleDesign } from './assemble';
import type { DesignContext } from './context';
import { generateVariant } from './generate';
import type { Generated, VariantOptions } from './generate';
import type { AreaSums } from '../measure/areas';
import { levelCount, roofDeck } from '../measure/levels';
import type { StopReason } from './stack';
import { slideTowardRoad } from './slide';
import { highRiseSummary, lowRiseSummary, openGroundSummary, slenderSummary } from './summary';

/** Classification thresholds for "genuinely high-rise or extra-large" (MR 33 ข้อ 1). */
const HIGH_RISE_ROOF_DECK_M = 23;
const EXTRA_LARGE_M2 = 10_000;
/** Slender tower plate, as a share of the largest compliant plate. */
const SLENDER_SHARE = 0.5;
/** The slender tower must rise at least this many storeys above (b) to be worth showing. */
const SLENDER_MIN_EXTRA_STOREYS = 3;
/**
 * "More open ground" plate, as a share of the largest compliant plate: 60%, or a little more on a
 * plot so small that a 60% plate cannot hold one parking space.
 */
const OPEN_GROUND_SHARES: readonly number[] = [0.6, 0.75, 0.9];
const MIN_DESIGNS = 2;

export interface DesignInputs {
  readonly contexts: Readonly<Record<RegimeId, DesignContext | null>>;
  readonly base: CheckBase;
  readonly allowedFar: number;
  /** When rules are switched off, designs that fail a remaining check are still shown. */
  readonly hypothetical: boolean;
}

export interface DesignSet {
  readonly designs: readonly Design[];
  /** What stopped each regime's largest design, for naming the binding rule. */
  readonly stops: Readonly<Record<RegimeId, { readonly stop: StopReason; readonly sums: AreaSums } | null>>;
}

const LARGEST: VariantOptions = { plateAreaM2: Number.POSITIVE_INFINITY };

function isGenuinelyHigh(g: Generated): boolean {
  return roofDeck(g.stack.floors) >= HIGH_RISE_ROOF_DECK_M || g.stack.sums.gross >= EXTRA_LARGE_M2;
}

function stopOf(g: Generated | null): DesignSet['stops'][RegimeId] {
  return g === null ? null : { stop: g.stack.stop, sums: g.stack.sums };
}

const FRONT_ACCESS_RULE = 'bma.front-access';
/** A slid tower may lose at most this much floor area against the centred one. */
const SLIDE_AREA_TOLERANCE_M2 = 1;

function frontAccessPasses(d: Design): boolean {
  return d.checks.some((c) => c.ruleId === FRONT_ACCESS_RULE && c.status === 'pass');
}

/**
 * The slender tower, moved toward the road when that lets it meet the ordinance ข้อ 53 and it
 * still passes every check with the same floor area; otherwise left centred (its check then warns).
 */
function preferNearRoad(
  ctx: DesignContext,
  centred: Generated,
  opts: VariantOptions,
  make: (g: Generated) => Design,
  keeps: (g: Generated) => boolean,
): Design {
  const design = make(centred);
  if (frontAccessPasses(design)) return design;
  const slid = slideTowardRoad(ctx, centred, opts);
  if (slid === null || !keeps(slid)) return design;
  const moved = make(slid);
  const sameArea = moved.totals.grossFloorAreaM2 >= design.totals.grossFloorAreaM2 - SLIDE_AREA_TOLERANCE_M2;
  return moved.passes && sameArea && frontAccessPasses(moved) ? moved : design;
}

export function generateDesigns(inputs: DesignInputs): DesignSet {
  const { contexts, base, allowedFar } = inputs;
  const out: Design[] = [];
  const add = (g: Generated | null, make: (g: Generated) => Design): void => {
    if (g === null || g.stack.floors.length === 0) return;
    const design = make(g);
    if (design.passes || inputs.hypothetical) out.push(design);
  };
  const finish = (ctx: DesignContext, g: Generated, id: string, name: string, summarise: (d: Omit<Design, 'summary'>) => string): Design =>
    assembleDesign(ctx, g, { id, name, regime: ctx.regime.regime, summarise }, base, allowedFar);

  const low = contexts.lowRise;
  const high = contexts.highRise;
  const a = low === null ? null : generateVariant(low, LARGEST);
  const b = high === null ? null : generateVariant(high, LARGEST);
  if (low !== null) add(a, (g) => finish(low, g, 'low-rise-block', 'Low-rise block', (d) => lowRiseSummary(d, low.regime, g.stack.stop, low.reading)));
  if (high !== null && b !== null && isGenuinelyHigh(b)) {
    add(b, (g) => finish(high, g, 'high-rise-max', 'High-rise, maximum floor area', (d) => highRiseSummary(d, high.regime, g.stack.stop, high.reading)));
  }
  if (high !== null && b !== null) {
    const cOpts: VariantOptions = { plateAreaM2: SLENDER_SHARE * regionArea(b.plate), grossCapM2: b.stack.sums.gross };
    const centred = generateVariant(high, cOpts);
    const tallEnough = (g: Generated): boolean => levelCount(g.stack.floors) >= levelCount(b.stack.floors) + SLENDER_MIN_EXTRA_STOREYS;
    const make = (g: Generated): Design =>
      finish(high, g, 'slender-tower', 'Slender tower', (d) => slenderSummary(d, high.regime, g.stack.stop, SLENDER_SHARE, b.stack.sums, high.reading));
    if (centred !== null && tallEnough(centred) && isGenuinelyHigh(centred)) {
      add(centred, (g) => preferNearRoad(high, g, cOpts, make, (s) => tallEnough(s) && isGenuinelyHigh(s)));
    }
  }
  const fallbacks: ReadonlyArray<readonly [DesignContext | null, Generated | null, string, string]> = [
    [low, a, 'low-rise-open', 'Low-rise, more open ground'],
    [high, b, 'high-rise-open', 'High-rise, more open ground'],
  ];
  for (const [ctx, max, id, name] of fallbacks) {
    for (const share of OPEN_GROUND_SHARES) {
      if (out.length >= MIN_DESIGNS || ctx === null || max === null) break;
      const opts: VariantOptions = { plateAreaM2: share * regionArea(max.plate), maxStoreys: levelCount(max.stack.floors) };
      add(generateVariant(ctx, opts), (g) => finish(ctx, g, id, name, (d) => openGroundSummary(d, share)));
    }
  }
  if (out.length < MIN_DESIGNS && high !== null && b !== null && !out.some((d) => d.id === 'high-rise-max')) {
    add(b, (g) => finish(high, g, 'high-rise-max', 'High-rise, maximum floor area', (d) => highRiseSummary(d, high.regime, g.stack.stop, high.reading)));
  }
  return { designs: out, stops: { lowRise: stopOf(a), highRise: stopOf(b) } };
}

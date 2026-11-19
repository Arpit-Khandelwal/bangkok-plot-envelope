/**
 * The concept designs. (a) a low-rise block; (b) a high-rise using the most floor area, kept only
 * when it is genuinely high-rise or extra-large; (c) a slender tower with the same floor-area
 * target on about half the plate, kept when it gains at least three storeys on (b); and, while
 * fewer than two designs remain, smaller-plate "more open ground" variants of whichever regime
 * has an envelope. A design that fails its own checks is never returned unless rules are off.
 */
import { regionArea } from '../geom';
import type { Design, RegimeId } from '../types';
import type { CheckBase } from './assemble';
import { assembleDesign } from './assemble';
import type { DesignContext } from './context';
import { generateVariant } from './generate';
import type { Generated, VariantOptions } from './generate';
import type { AreaSums } from '../measure/areas';
import type { StopReason } from './stack';
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
  const top = g.stack.floors[g.stack.floors.length - 1]?.topM ?? 0;
  return top >= HIGH_RISE_ROOF_DECK_M || g.stack.sums.gross >= EXTRA_LARGE_M2;
}

function stopOf(g: Generated | null): DesignSet['stops'][RegimeId] {
  return g === null ? null : { stop: g.stack.stop, sums: g.stack.sums };
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
    const c = generateVariant(high, { plateAreaM2: SLENDER_SHARE * regionArea(b.plate), grossCapM2: b.stack.sums.gross });
    const tallEnough = c !== null && c.stack.floors.length >= b.stack.floors.length + SLENDER_MIN_EXTRA_STOREYS;
    if (c !== null && tallEnough && isGenuinelyHigh(c)) {
      add(c, (g) => finish(high, g, 'slender-tower', 'Slender tower', (d) => slenderSummary(d, high.regime, g.stack.stop, SLENDER_SHARE, b.stack.sums, high.reading)));
    }
  }
  const fallbacks: ReadonlyArray<readonly [DesignContext | null, Generated | null, string, string]> = [
    [low, a, 'low-rise-open', 'Low-rise, more open ground'],
    [high, b, 'high-rise-open', 'High-rise, more open ground'],
  ];
  for (const [ctx, max, id, name] of fallbacks) {
    for (const share of OPEN_GROUND_SHARES) {
      if (out.length >= MIN_DESIGNS || ctx === null || max === null) break;
      const opts: VariantOptions = { plateAreaM2: share * regionArea(max.plate), maxStoreys: max.stack.floors.length };
      add(generateVariant(ctx, opts), (g) => finish(ctx, g, id, name, (d) => openGroundSummary(d, share)));
    }
  }
  if (out.length < MIN_DESIGNS && high !== null && b !== null && !out.some((d) => d.id === 'high-rise-max')) {
    add(b, (g) => finish(high, g, 'high-rise-max', 'High-rise, maximum floor area', (d) => highRiseSummary(d, high.regime, g.stack.stop, high.reading)));
  }
  return { designs: out, stops: { lowRise: stopOf(a), highRise: stopOf(b) } };
}

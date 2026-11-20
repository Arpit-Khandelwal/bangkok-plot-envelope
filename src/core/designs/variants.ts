/**
 * The concept designs. (a) a low-rise block; (b) a high-rise using the most floor area, kept only
 * when it is genuinely high-rise or extra-large; (c) a slender tower with the same floor-area
 * target on about half the plate, kept when it gains at least three storeys on (b); and, while
 * fewer than two designs remain, smaller-plate "more open ground" variants of whichever regime
 * has an envelope. A design that fails its own checks is never returned unless rules are off.
 * The slender tower slides toward the road when that meets the ordinance's road-facing façade rule.
 */
import { regionArea, unionAll } from '../geom';
import { FRONT_FACADE_SHARE } from '../measure/front-access';
import { frontVerdict } from './front-rule';
import type { FrontVerdict } from './front-rule';
import type { Design, Problem, RegimeId } from '../types';
import type { CheckBase } from './assemble';
import { assembleDesign } from './assemble';
import type { DesignContext } from './context';
import { generateVariant } from './generate';
import type { Generated, VariantOptions } from './generate';
import type { AreaSums } from '../measure/areas';
import { levelCount, roofDeck } from '../measure/levels';
import type { StopReason } from './stack';
import { bandAlongRoad, slideTowardRoad } from './slide';
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
/**
 * A fallback plate can come out smaller than its target (the open-space cap), but it is taken as at
 * least this share of it when ruling a target out, so a plate that might qualify is still tried.
 */
const MIN_PLATE_SHARE_OF_TARGET = 0.5;

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
  /** Non-blocking reasons a regime offers no design, beyond the general ones. */
  readonly problems: readonly Problem[];
}

export const FIRE_ROAD_PROBLEM =
  'No high-rise design is offered: on every plate that fits, the 6 m fire road all around the building (Ministerial Regulation 33, clause 3) leaves too little open ground for the permeable planting the plan requires (half the open space).';

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

/** The front-access verdict for the generated floors, as the check will judge them (see `front-rule.ts`). */
function verdictOf(ctx: DesignContext, g: Generated): FrontVerdict {
  const input = { site: ctx.site, regime: ctx.regime, strict: ctx.strictFront, buildingType: ctx.buildingType, storeys: levelCount(g.stack.floors), heightM: roofDeck(g.stack.floors) };
  return frontVerdict(input, unionAll(g.stack.floors.map((f) => f.outline)));
}

/**
 * True when no plate of `areaM2` with the storeys of `g` can meet the ordinance: the building falls
 * under ข้อ 53, whose road-facing façade must exceed an eighth of the perimeter, and the roads'
 * whole length is under an eighth of the shortest perimeter that area can have (a circle's).
 */
function cannotMeetFront(ctx: DesignContext, g: Generated, areaM2: number): boolean {
  if (!frontRuleOn(ctx) || verdictOf(ctx, g).clause !== 'clause53') return false;
  const roadM = ctx.site.edges.reduce((sum, e) => sum + (e.spec.kind === 'road' ? e.lengthM : 0), 0);
  return roadM <= FRONT_FACADE_SHARE * 2 * Math.sqrt(Math.PI * areaM2);
}

function frontRuleOn(ctx: DesignContext): boolean {
  return ctx.regime.rules.some((r) => r.id === FRONT_ACCESS_RULE && !r.disabled);
}

/** `f` with its result kept per argument, so asking again for the same argument costs nothing. */
function memoize<A extends object, T>(f: (a: A) => T): (a: A) => T {
  const memo = new WeakMap<A, T>();
  return (a) => {
    if (memo.has(a)) return memo.get(a) as T;
    const value = f(a);
    memo.set(a, value);
    return value;
  };
}

/** `f`, run at most once, on first use. */
function once<T>(f: () => T): () => T {
  let done = false;
  let value: T | undefined;
  return () => {
    if (!done) {
      value = f();
      done = true;
    }
    return value as T;
  };
}

/**
 * What `preferNearRoad` may compute for one generated design, each part on first use and at most
 * once: the design as placed, its verdict, and each move toward the road with its design. A design
 * offered twice (the high-rise, once as genuinely high and again as a fallback) shares one trial,
 * so the second offer only applies its own `keeps`.
 */
interface NearRoadTrial {
  readonly ctx: DesignContext;
  readonly placed: Generated;
  readonly make: (g: Generated) => Design;
  readonly verdict: (g: Generated) => FrontVerdict;
  readonly moves: readonly (() => Generated | null)[];
}

function nearRoadTrial(ctx: DesignContext, placed: Generated, opts: VariantOptions, make: (g: Generated) => Design): NearRoadTrial {
  return {
    ctx,
    placed,
    make: memoize(make),
    verdict: memoize((g: Generated) => verdictOf(ctx, g)),
    moves: [slideTowardRoad, bandAlongRoad].map((place) => once(() => place(ctx, placed, opts))),
  };
}

/**
 * The design, when it falls under ข้อ 53 and misses it where it stands: moved toward the road, or
 * else rebuilt on a band along the road, whichever first meets it and still passes every check with
 * the same floor area; otherwise left where it is.
 */
function preferNearRoad(trial: NearRoadTrial, keeps: (g: Generated) => boolean): Design {
  const design = trial.make(trial.placed);
  if (!frontRuleOn(trial.ctx)) return design;
  const verdict = trial.verdict(trial.placed);
  if (verdict.met || verdict.clause !== 'clause53') return design;
  for (const move of trial.moves) {
    const found = move();
    if (found === null || !keeps(found) || !trial.verdict(found).met) continue;
    const moved = trial.make(found);
    const sameArea = moved.totals.grossFloorAreaM2 >= design.totals.grossFloorAreaM2 - SLIDE_AREA_TOLERANCE_M2;
    if (moved.passes && sameArea) return moved;
  }
  return design;
}

/** True when the design fails its front-access check. */
function frontFails(d: Design): boolean {
  return d.checks.some((c) => c.ruleId === FRONT_ACCESS_RULE && c.status === 'fail');
}

export function generateDesigns(inputs: DesignInputs): DesignSet {
  const { contexts, base, allowedFar } = inputs;
  const out: Design[] = [];
  // Every design moves toward the road when that lets it meet ข้อ 53. One that still fails its
  // front-access clause is ruled out by the ordinance as read, so it is never a candidate.
  const offer = (trial: NearRoadTrial, keeps: (g: Generated) => boolean = () => true): void => {
    if (trial.placed.stack.floors.length === 0) return;
    const design = preferNearRoad(trial, keeps);
    if (frontFails(design)) return;
    if (design.passes || inputs.hypothetical) out.push(design);
  };
  const add = (ctx: DesignContext, g: Generated | null, opts: VariantOptions, make: (g: Generated) => Design, keeps?: (g: Generated) => boolean): void => {
    if (g !== null) offer(nearRoadTrial(ctx, g, opts, make), keeps);
  };
  const finish = (ctx: DesignContext, g: Generated, id: string, name: string, summarise: (d: Omit<Design, 'summary'>) => string): Design =>
    assembleDesign(ctx, g, { id, name, regime: ctx.regime.regime, summarise }, base, allowedFar);

  const low = contexts.lowRise;
  const high = contexts.highRise;
  const a = low === null ? null : generateVariant(low, LARGEST);
  const b = high === null ? null : generateVariant(high, LARGEST);
  const highMax = (h: DesignContext) => (g: Generated): Design =>
    finish(h, g, 'high-rise-max', 'High-rise, maximum floor area', (d) => highRiseSummary(d, h.regime, g.stack.stop, h.reading));
  if (low !== null) add(low, a, LARGEST, (g) => finish(low, g, 'low-rise-block', 'Low-rise block', (d) => lowRiseSummary(d, low.regime, g.stack.stop, low.reading)));
  const highMaxTrial = high !== null && b !== null ? nearRoadTrial(high, b, LARGEST, highMax(high)) : null;
  if (highMaxTrial !== null && isGenuinelyHigh(highMaxTrial.placed)) offer(highMaxTrial, isGenuinelyHigh);
  if (high !== null && b !== null) {
    const cOpts: VariantOptions = { plateAreaM2: SLENDER_SHARE * regionArea(b.plate), grossCapM2: b.stack.sums.gross };
    const centred = generateVariant(high, cOpts);
    const tallEnough = (g: Generated): boolean => levelCount(g.stack.floors) >= levelCount(b.stack.floors) + SLENDER_MIN_EXTRA_STOREYS;
    const make = (g: Generated): Design =>
      finish(high, g, 'slender-tower', 'Slender tower', (d) => slenderSummary(d, high.regime, g.stack.stop, SLENDER_SHARE, b.stack.sums, high.reading));
    if (centred !== null && tallEnough(centred) && isGenuinelyHigh(centred)) {
      add(high, centred, cOpts, make, (s) => tallEnough(s) && isGenuinelyHigh(s));
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
      if (cannotMeetFront(ctx, max, opts.plateAreaM2 * MIN_PLATE_SHARE_OF_TARGET)) continue;
      add(ctx, generateVariant(ctx, opts), opts, (g) => finish(ctx, g, id, name, (d) => openGroundSummary(d, share)));
    }
  }
  if (out.length < MIN_DESIGNS && highMaxTrial !== null && !out.some((d) => d.id === 'high-rise-max')) {
    offer(highMaxTrial);
  }
  return { designs: out, stops: { lowRise: stopOf(a), highRise: stopOf(b) }, problems: fireRoadProblems(high, b) };
}

/** The reason no high-rise is offered when only the fire road and the planting stand in the way. */
function fireRoadProblems(high: DesignContext | null, b: Generated | null): readonly Problem[] {
  if (high === null || b !== null || !high.fireRoad) return [];
  if (generateVariant({ ...high, fireRoad: false }, LARGEST) === null) return [];
  return [{ code: 'no-design', message: FIRE_ROAD_PROBLEM, blocking: false }];
}

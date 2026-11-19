/**
 * One concept design: the plate sized for open space, then floors stacked with parking at the
 * bottom, sized to the stalls required (see `stackWithParking`).
 */
import { regionArea } from '../geom';
import { parkingNeed, stallsProvided } from '../measure/areas';
import { fireRoadGround, plantingRequiredM2 } from '../measure/fire-planting';
import { levelCount } from '../measure/levels';
import type { Region } from '../types';
import { MAX_STOREYS } from './context';
import type { DesignContext } from './context';
import { MIN_MAIN_WIDTH_M } from './habitable';
import { insetToArea, insetUntil } from './plate';
import type { Plate } from './plate';
import { buildStack } from './stack';
import type { Stack } from './stack';

/** Coverage is kept this far under the open-space bound, against rounding in the checks. */
const OPEN_SPACE_MARGIN_M2 = 0.5;
/** Plates are sized to within this of their target area. */
const PLATE_TOLERANCE_M2 = 1;
/** Rounds of re-sizing the plate for the open space tied to total floor area. */
const OPEN_SPACE_ROUNDS = 5;
/** When no design fits a plate, retry on a plate this share of the size, at most this often. */
const PLATE_RETRY_SHARE = 0.6;
const PLATE_RETRIES = 6;

export interface VariantOptions {
  /** Target plate area; the open-space bound still applies. Infinity for the largest plate. */
  readonly plateAreaM2: number;
  readonly maxStoreys?: number;
  readonly grossCapM2?: number;
}

export interface Generated {
  readonly plate: Region;
  /** Largest ground coverage the open-space rules allow for this design's floor area. */
  readonly coverageCapM2: number;
  readonly stack: Stack;
}

/** Largest coverage that leaves every open-space requirement met for a building of `grossM2`. */
export function coverageCap(ctx: DesignContext, grossM2: number): number {
  const plot = ctx.site.areaM2;
  let cap = plot;
  for (const req of ctx.regime.openSpace) {
    if (req.basis === 'plotArea') cap = Math.min(cap, plot * (1 - req.share));
    // Coverage is at least the largest floor, so plot - C >= s * C is enough.
    if (req.basis === 'largestFloor') cap = Math.min(cap, plot / (1 + req.share));
    if (req.basis === 'totalFloorArea') cap = Math.min(cap, plot - req.share * grossM2);
  }
  return cap - OPEN_SPACE_MARGIN_M2;
}

/** Ground outside the fire-road ring is kept this far above the planting required, against rounding. */
const FIRE_PLANTING_MARGIN_M2 = 0.5;

/**
 * True when the 6 m fire road around `plate` and the permeable planting both fit by area, for a
 * building of `grossM2` whose largest floor is at most the plate (see `fireRoadGround`).
 */
export function fireRoadFits(ctx: DesignContext, plate: Region, grossM2: number): boolean {
  if (!ctx.fireRoad) return true;
  const basis = { plotM2: ctx.site.areaM2, grossM2, largestFloorM2: regionArea(plate) };
  return fireRoadGround(ctx.site, plate).leftM2 >= plantingRequiredM2(ctx.regime.openSpace, basis) + FIRE_PLANTING_MARGIN_M2;
}

/** The plate, shrunk further when needed so the fire road and the planting both fit. */
function withFireRoad(ctx: DesignContext, plate: Plate, grossM2: number): Plate {
  if (fireRoadFits(ctx, plate.region, grossM2)) return plate;
  return insetUntil(plate.region, (r) => fireRoadFits(ctx, r, grossM2), MIN_MAIN_WIDTH_M);
}

/** Stalls required by the main-use floor area of a stack. */
function required(ctx: DesignContext, stack: Stack): number {
  return parkingNeed(stack.sums.main, ctx.regime.parking, ctx.assumptions, ctx.buildingType).required;
}

function hasMainUse(stack: Stack): boolean {
  return stack.floors.some((f) => f.use !== 'parking');
}

/** Most doublings of the stall count tried when the first guess is not enough. */
const MAX_STALL_DOUBLINGS = 12;

interface Probe {
  readonly stalls: number;
  readonly stack: Stack;
  /** Stalls provided less stalls required: >= 0 when the stack meets its own requirement. */
  readonly margin: number;
}

/**
 * The next stall count to try between a failing `lo` and a passing `hi`: where the margin, nearly
 * linear in the stall count, crosses zero; the midpoint when the last guess did not halve the bracket.
 */
function nextGuess(lo: Probe, hi: Probe, bisect: boolean): number {
  const mid = Math.floor((lo.stalls + hi.stalls) / 2);
  if (bisect) return mid;
  const t = -lo.margin / Math.max(hi.margin - lo.margin, 1e-9);
  const guess = Math.ceil(lo.stalls + t * (hi.stalls - lo.stalls));
  return Math.min(hi.stalls - 1, Math.max(lo.stalls + 1, guess));
}

/**
 * The stack whose parking meets its own requirement with the fewest stalls. The requirement
 * depends on the main-use area, which depends on the parking (more parking leaves less main use
 * under a floor-area limit), so this searches the stall count s for the smallest s whose stack
 * provides what it requires: a first guess from the stack without parking, then a bracketed search
 * (false position, falling back to bisection). Every stack returned provides at least the stalls
 * it requires.
 */
function stackWithParking(ctx: DesignContext, plate: Region, opts: VariantOptions): Stack | null {
  const probe = (stalls: number, sketch = true): Probe => {
    const stack = buildStack(ctx, plate, { ...opts, parkingStalls: stalls, sketch });
    const margin = hasMainUse(stack) ? stallsProvided(stack.sums.parking, ctx.assumptions) - required(ctx, stack) : Number.NEGATIVE_INFINITY;
    return { stalls, stack, margin };
  };
  const bare = probe(0);
  if (!hasMainUse(bare.stack)) return null;
  if (bare.margin >= 0) return exactStack(ctx, plate, opts, probe, 0);
  if (ctx.regime.parking.ruleId !== null && stallsProvided(regionArea(plate), ctx.assumptions) === 0) return null;
  let lo = bare;
  let hi = probe(required(ctx, bare.stack));
  for (let i = 0; i < MAX_STALL_DOUBLINGS && Number.isFinite(hi.margin) && hi.margin < 0; i++) {
    lo = hi;
    hi = probe(hi.stalls * 2);
  }
  if (hi.margin < 0) return null;
  let bisect = false;
  while (hi.stalls - lo.stalls > 1) {
    const span = hi.stalls - lo.stalls;
    const next = probe(nextGuess(lo, hi, bisect));
    if (next.margin >= 0) hi = next;
    else lo = Number.isFinite(next.margin) ? next : { ...next, margin: lo.margin };
    bisect = hi.stalls - lo.stalls > span / 2;
  }
  return exactStack(ctx, plate, opts, probe, hi.stalls);
}

/** Extra stalls tried when the exact stack falls short of the sketched one. */
const EXACT_RETRIES = 3;
/** Parking may exceed the requirement by at most this many stalls. */
const MAX_SPARE_STALLS = 1;

/**
 * Rebuilds the chosen stall count exactly. A trimmed floor can come out up to the area tolerance
 * smaller than sketched, which can change the requirement by a stall, so a few more are tried.
 */
function exact(probe: (stalls: number, sketch?: boolean) => Probe, stalls: number): Probe | null {
  for (let extra = 0; extra <= EXACT_RETRIES; extra++) {
    const found = probe(stalls + extra, false);
    if (found.margin >= 0) return found;
  }
  return null;
}

/**
 * The exact stack for the chosen stall count. Habitable plates make the margin jump: a shared level
 * whose parking part cannot be cut falls back to a whole parking floor, and the requirement drops
 * when a narrow rest of a shared level or a small top floor is lost. The search can then stop on a
 * count that parks many stalls too many, so the counts above it are scanned for one that parks at
 * most one spare; failing that, the parking is sized to the lower requirement with the narrow rest
 * left open and no storey added, when that keeps the main use.
 */
function exactStack(ctx: DesignContext, plate: Region, opts: VariantOptions, probe: (stalls: number, sketch?: boolean) => Probe, stalls: number): Stack | null {
  const found = exact(probe, stalls);
  if (found === null || found.margin <= MAX_SPARE_STALLS) return found?.stack ?? null;
  return (scanUp(probe, found) ?? sizeToLowerRequirement(ctx, plate, opts, found)).stack;
}

/** The parking sized to the lower requirement, the narrow rest left open and no storey added. */
function sizeToLowerRequirement(ctx: DesignContext, plate: Region, opts: VariantOptions, found: Probe): Probe {
  let best = found;
  for (let i = 0; i < EXACT_RETRIES && best.margin > MAX_SPARE_STALLS; i++) {
    const fewer = required(ctx, best.stack);
    const maxStoreys = Math.min(opts.maxStoreys ?? MAX_STOREYS, levelCount(best.stack.floors));
    const stack = buildStack(ctx, plate, { ...opts, maxStoreys, parkingStalls: fewer, openSharedRest: true });
    const margin = hasMainUse(stack) ? stallsProvided(stack.sums.parking, ctx.assumptions) - required(ctx, stack) : Number.NEGATIVE_INFINITY;
    const keepsMain = stack.sums.main >= best.stack.sums.main - PLATE_TOLERANCE_M2;
    if (!(margin >= 0 && margin < best.margin && keepsMain)) break;
    best = { stalls: fewer, stack, margin };
  }
  return best;
}

/** The first count above `found` whose exact stack parks the requirement with at most one spare. */
function scanUp(probe: (stalls: number, sketch?: boolean) => Probe, found: Probe): Probe | null {
  const last = found.stalls + found.margin + EXACT_RETRIES;
  for (let s = found.stalls + 1; s <= last; s++) {
    const sketched = probe(s);
    if (!(sketched.margin >= 0 && sketched.margin <= MAX_SPARE_STALLS)) continue;
    const confirmed = exact(probe, s);
    if (confirmed !== null && confirmed.margin <= MAX_SPARE_STALLS) return confirmed;
  }
  return null;
}

/** The finite smallest total-floor-area ceiling, as a first guess of the building's size. */
function grossGuess(ctx: DesignContext, opts: VariantOptions): number {
  const totals = ctx.regime.gfaLimits.filter((l) => l.measure === 'totalFloorArea').map((l) => l.limitM2);
  const guess = Math.min(opts.grossCapM2 ?? Number.POSITIVE_INFINITY, ...totals);
  return Number.isFinite(guess) ? guess : 0;
}

/**
 * The design on the requested plate. On a big plot the largest open-space plate can be so large
 * that the floor-area limit is reached on the ground floor, leaving no room for parking below the
 * main use. Then smaller plates are tried (each a share of the one before) and the one giving the
 * most main-use floor area is kept.
 */
export function generateVariant(ctx: DesignContext, opts: VariantOptions): Generated | null {
  if (ctx.basePlate.length === 0) return null;
  const first = generateOnPlate(ctx, opts);
  if (first !== null) return first;
  let target = Math.min(opts.plateAreaM2, regionArea(ctx.basePlate));
  let best: Generated | null = null;
  for (let attempt = 0; attempt < PLATE_RETRIES; attempt++) {
    target *= PLATE_RETRY_SHARE;
    const found = generateOnPlate(ctx, { ...opts, plateAreaM2: target });
    if (found !== null && (best === null || found.stack.sums.main > best.stack.sums.main)) best = found;
  }
  return best;
}

/** The design on exactly this plate, or null when it does not fit the open-space rules. */
export function generateOnFixedPlate(ctx: DesignContext, plate: Region, opts: VariantOptions): Generated | null {
  const stack = stackWithParking(ctx, plate, opts);
  if (stack === null) return null;
  const needed = coverageCap(ctx, stack.sums.gross);
  return regionArea(plate) <= needed && fireRoadFits(ctx, plate, stack.sums.gross) ? { plate, coverageCapM2: needed, stack } : null;
}

function generateOnPlate(ctx: DesignContext, opts: VariantOptions): Generated | null {
  let gross = grossGuess(ctx, opts);
  for (let round = 0; round < OPEN_SPACE_ROUNDS; round++) {
    const cap = coverageCap(ctx, gross);
    if (!(cap > 0)) return null;
    const sized = insetToArea(ctx.basePlate, Math.min(cap, opts.plateAreaM2), PLATE_TOLERANCE_M2, MIN_MAIN_WIDTH_M);
    const plate = withFireRoad(ctx, sized, gross);
    if (plate.areaM2 <= 0) return null;
    ctx.openWidths.set(plate.region, MIN_MAIN_WIDTH_M);
    const stack = stackWithParking(ctx, plate.region, opts);
    if (stack === null) return null;
    const needed = coverageCap(ctx, stack.sums.gross);
    if (plate.areaM2 <= needed && fireRoadFits(ctx, plate.region, stack.sums.gross)) return { plate: plate.region, coverageCapM2: needed, stack };
    gross = Math.max(gross, stack.sums.gross);
  }
  return null;
}

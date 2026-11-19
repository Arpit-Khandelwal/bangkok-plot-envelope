/**
 * One concept design: the plate sized for open space, then floors stacked with parking at the
 * bottom. Parking and the floor-area limit depend on each other (more parking floors leave less
 * main use, which needs less parking), so the number of parking floors is searched upward from
 * zero until the stalls provided meet the requirement; the search is bounded by the storey cap.
 */
import { regionArea } from '../geom';
import { parkingNeed, stallsProvided } from '../measure/areas';
import type { Region } from '../types';
import { MAX_STOREYS } from './context';
import type { DesignContext } from './context';
import { insetToArea } from './plate';
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

/** Fewest parking floors at the bottom of the stack that meet the parking requirement. */
function stackWithParking(ctx: DesignContext, plate: Region, opts: VariantOptions): Stack | null {
  const plateArea = regionArea(plate);
  if (ctx.regime.parking.ruleId !== null && stallsProvided(plateArea, ctx.assumptions) === 0) {
    // Not even one stall fits on a whole floor: parking cannot be provided on this plate.
    const bare = buildStack(ctx, plate, { ...opts, parkingFloors: 0 });
    const need = parkingNeed(bare.sums.main, ctx.regime.parking, ctx.assumptions, ctx.buildingType);
    return need.required === 0 ? bare : null;
  }
  for (let parkingFloors = 0; parkingFloors <= MAX_STOREYS; parkingFloors++) {
    const stack = buildStack(ctx, plate, { ...opts, parkingFloors });
    if (!stack.floors.some((f) => f.use !== 'parking')) return null;
    const need = parkingNeed(stack.sums.main, ctx.regime.parking, ctx.assumptions, ctx.buildingType);
    if (stallsProvided(stack.sums.parking, ctx.assumptions) >= need.required) return stack;
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

function generateOnPlate(ctx: DesignContext, opts: VariantOptions): Generated | null {
  let gross = grossGuess(ctx, opts);
  for (let round = 0; round < OPEN_SPACE_ROUNDS; round++) {
    const cap = coverageCap(ctx, gross);
    if (!(cap > 0)) return null;
    const plate = insetToArea(ctx.basePlate, Math.min(cap, opts.plateAreaM2), PLATE_TOLERANCE_M2);
    if (plate.areaM2 <= 0) return null;
    const stack = stackWithParking(ctx, plate.region, opts);
    if (stack === null) return null;
    const needed = coverageCap(ctx, stack.sums.gross);
    if (plate.areaM2 <= needed) return { plate: plate.region, coverageCapM2: needed, stack };
    gross = Math.max(gross, stack.sums.gross);
  }
  return null;
}

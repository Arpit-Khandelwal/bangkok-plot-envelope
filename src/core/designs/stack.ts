/**
 * Stacks floors on a plate from the ground up. Every floor is cut to the part of the floor below
 * where the road planes allow its top plus the parapet: a step-back terrace carries a parapet
 * too, so every floor (not only the top one) must clear the plane at top + parapet. Floors stop
 * at the roof-deck cap, at the floor-area limits, or when the plane leaves too little plate.
 */
import { regionArea } from '../geom';
import { addFloor, countsToward, limitCeiling, measuredArea, NO_AREA } from '../measure/areas';
import type { AreaSums } from '../measure/areas';
import type { Floor, FloorUse, Region } from '../types';
import { MAX_STOREYS } from './context';
import type { DesignContext } from './context';
import { clipToHeight, insetToArea } from './plate';

/** A top floor smaller than this is not worth building. */
export const MIN_VIABLE_PLATE_M2 = 150;
/** The partial top floor lands this close under the floor-area limit. */
export const AREA_TOLERANCE_M2 = 1;
/** Heights are kept to the millimetre so a floor's base is exactly the top of the one below. */
const HEIGHT_GRID = 1000;

/** Why the stack stopped: a floor-area limit, or a geometric rule. */
export type StopReason =
  | { readonly kind: 'limit'; readonly ruleId: string | null }
  | { readonly kind: 'cap'; readonly ruleId: string | null }
  | { readonly kind: 'plane'; readonly ruleId: string | null }
  | { readonly kind: 'storeys'; readonly ruleId: null };

export interface StackOptions {
  readonly parkingFloors: number;
  /** Stop after this many storeys. */
  readonly maxStoreys?: number;
  /** An extra cap on total floor area (a variant's target), on top of the legal limits. */
  readonly grossCapM2?: number;
}

export interface Stack {
  readonly floors: readonly Floor[];
  readonly sums: AreaSums;
  readonly stop: StopReason;
}

interface Allowance {
  readonly areaM2: number;
  readonly ruleId: string | null;
}

/** How much more floor area of this use the limits allow. */
function allowance(ctx: DesignContext, sums: AreaSums, use: FloorUse, grossCapM2: number): Allowance {
  let best: Allowance = { areaM2: grossCapM2 - sums.gross, ruleId: null };
  for (const limit of ctx.regime.gfaLimits) {
    if (!countsToward(limit, use, ctx.reading)) continue;
    const room = limitCeiling(limit) - measuredArea(limit, sums, ctx.reading);
    if (room < best.areaM2) best = { areaM2: room, ruleId: limit.ruleId };
  }
  return best;
}

function roundHeight(z: number): number {
  return Math.round(z * HEIGHT_GRID) / HEIGHT_GRID;
}

function firstPlaneRule(ctx: DesignContext): string | null {
  return ctx.regime.heightPlanes[0]?.ruleId ?? null;
}

interface Next {
  readonly floor: Floor | null;
  readonly stop: StopReason | null;
}

/** The next floor, or the reason there is none (and whether it is the last). */
function nextFloor(ctx: DesignContext, below: Region, level: number, baseM: number, sums: AreaSums, opts: StackOptions, minPlateM2: number): Next {
  const use: FloorUse = level <= opts.parkingFloors ? 'parking' : ctx.mainUse;
  const height = use === 'parking' ? ctx.parkingFloorToFloorM : ctx.mainFloorToFloorM;
  const topM = roundHeight(baseM + height);
  if (ctx.roofDeckCapM !== null && topM >= ctx.roofDeckCapM) return { floor: null, stop: { kind: 'cap', ruleId: ctx.capRuleId } };
  const full = clipToHeight(ctx.site, below, ctx.regime.heightPlanes, topM + ctx.assumptions.parapetM);
  const fullArea = regionArea(full);
  if (fullArea < minPlateM2) return { floor: null, stop: { kind: 'plane', ruleId: firstPlaneRule(ctx) } };
  const room = allowance(ctx, sums, use, opts.grossCapM2 ?? Number.POSITIVE_INFINITY);
  if (fullArea <= room.areaM2) {
    return { floor: { level, use, baseM, topM, outline: full, areaM2: fullArea }, stop: null };
  }
  const limitStop: StopReason = { kind: 'limit', ruleId: room.ruleId };
  if (room.areaM2 < minPlateM2) return { floor: null, stop: limitStop };
  const part = insetToArea(full, room.areaM2, AREA_TOLERANCE_M2);
  if (part.areaM2 < minPlateM2) return { floor: null, stop: limitStop };
  return { floor: { level, use, baseM, topM, outline: part.region, areaM2: part.areaM2 }, stop: limitStop };
}

export function buildStack(ctx: DesignContext, plate: Region, opts: StackOptions): Stack {
  const minPlateM2 = Math.min(MIN_VIABLE_PLATE_M2, regionArea(plate) * (1 - 1e-9));
  const maxStoreys = Math.min(MAX_STOREYS, opts.maxStoreys ?? MAX_STOREYS);
  const floors: Floor[] = [];
  let sums = NO_AREA;
  let below = plate;
  let baseM = 0;
  for (let level = 1; level <= maxStoreys; level++) {
    const next = nextFloor(ctx, below, level, baseM, sums, opts, minPlateM2);
    if (next.floor !== null) {
      floors.push(next.floor);
      sums = addFloor(sums, next.floor.use, next.floor.areaM2);
      below = next.floor.outline;
      baseM = next.floor.topM;
    }
    if (next.stop !== null) return { floors, sums, stop: next.stop };
  }
  return { floors, sums, stop: { kind: 'storeys', ruleId: null } };
}

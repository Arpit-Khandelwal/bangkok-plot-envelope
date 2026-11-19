/**
 * Stacks floors on a plate from the ground up. Every floor is cut to the part of the floor below
 * where the road planes allow its top plus the parapet: a step-back terrace carries a parapet
 * too, so every floor (not only the top one) must clear the plane at top + parapet. Floors stop
 * at the roof-deck cap, at the floor-area limits, or when the plane leaves too little plate. Every
 * floor outline is habitable (see `habitable.ts`): a step-back that leaves only a thin strip is
 * removed, and a floor whose habitable part is below the minimum viable plate ends the stack.
 *
 * Parking is sized to the stalls asked for: whole parking floors from the ground up while a full
 * floor is still needed, then one shared level (see `shared-level.ts`) whose parking part holds the
 * rest. A shared level is two Floor entries with the same level and heights.
 */
import { regionArea } from '../geom';
import { addFloor, countsToward, limitCeiling, measuredArea, NO_AREA } from '../measure/areas';
import type { AreaSums } from '../measure/areas';
import type { Floor, FloorUse, Region } from '../types';
import { MAX_STOREYS } from './context';
import type { DesignContext } from './context';
import { cutToArea } from './cut';
import { clipToHeight, insetToArea, plateOf } from './plate';
import type { Plate } from './plate';
import { governingRoadEdge, inwardLine } from './road-edge';
import { habitable, minWidthFor } from './habitable';
import { splitLevel } from './shared-level';

/**
 * The habitable part of `region` where the road planes allow `heightM`: `clipToHeight`, then every
 * part narrower than `minWidthM` removed (a step-back can leave a thin strip). Remembered per plate,
 * height and width, since it is a pure function of the three.
 */
function clipped(ctx: DesignContext, region: Region, heightM: number, minWidthM: number): Region {
  const key = `${heightM}|${minWidthM}`;
  const byKey = ctx.clipMemo.get(region) ?? new Map<string, Region>();
  const known = byKey.get(key);
  if (known !== undefined) return known;
  const cut = clipToHeight(ctx.site, region, ctx.regime.heightPlanes, heightM);
  const alreadyOpen = cut === region && (ctx.openWidths.get(region) ?? 0) >= minWidthM;
  const result = alreadyOpen ? region : habitable(cut, minWidthM);
  if (!alreadyOpen) ctx.openWidths.set(result, minWidthM);
  ctx.clipMemo.set(region, new Map(byKey).set(key, result));
  return result;
}

/** A top floor smaller than this is not worth building. */
export const MIN_VIABLE_PLATE_M2 = 150;
/** The partial top floor lands this close under the floor-area limit. */
export const AREA_TOLERANCE_M2 = 1;
/** A main-use part of a shared level smaller than this is left out. */
const MIN_SHARED_PART_M2 = 1;
/** Heights are kept to the millimetre so a floor's base is exactly the top of the one below. */
const HEIGHT_GRID = 1000;

/** Why the stack stopped: a floor-area limit, or a geometric rule. */
export type StopReason =
  | { readonly kind: 'limit'; readonly ruleId: string | null }
  | { readonly kind: 'cap'; readonly ruleId: string | null }
  | { readonly kind: 'plane'; readonly ruleId: string | null }
  | { readonly kind: 'storeys'; readonly ruleId: null };

export interface StackOptions {
  /** Stalls the parking must hold; 0 for no parking. */
  readonly parkingStalls: number;
  /** Stop after this many storeys (levels). */
  readonly maxStoreys?: number;
  /** An extra cap on total floor area (a variant's target), on top of the legal limits. */
  readonly grossCapM2?: number;
  /**
   * Sizing only: a floor trimmed to a floor-area limit keeps its untrimmed outline and takes the
   * limit as its area, skipping the costly inset. Used while searching the parking; the stack that
   * is kept is always rebuilt exactly.
   */
  readonly sketch?: boolean;
  /**
   * Leave the rest of a shared level open instead of building main use on it. Used when that rest
   * is too narrow to use at the stall count that would park it, so that the parking can match a
   * requirement that would otherwise jump past it (see `stackWithParking`).
   */
  readonly openSharedRest?: boolean;
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

interface Level {
  readonly base: Region;
  readonly level: number;
  readonly baseM: number;
  readonly sums: AreaSums;
  readonly opts: StackOptions;
  readonly minPlateM2: number;
}

interface Next {
  readonly floors: readonly Floor[];
  readonly stop: StopReason | null;
  /**
   * The plate the next level stands on, when it is not the floors' own outline: a shared level's
   * whole plate, since the strip between its parts that is too narrow to use is left open under the
   * floor above rather than shrinking every floor above it.
   */
  readonly plate?: Region;
}

const NONE: readonly Floor[] = [];

/** `region` trimmed to `targetM2` (see `insetToArea`), or only its area when sketching. */
function trimTo(ctx: DesignContext, region: Region, targetM2: number, use: FloorUse, opts: StackOptions): Plate {
  if (opts.sketch === true) return { region, areaM2: Math.max(0, targetM2 - AREA_TOLERANCE_M2 / 2) };
  const widthM = minWidthFor(use);
  const inset = insetToArea(region, targetM2, AREA_TOLERANCE_M2, widthM);
  if (inset.areaM2 >= targetM2 - AREA_TOLERANCE_M2) return inset;
  // A uniform shrink loses a wing just the minimum width all at once; cut from the back instead.
  const cut = cutFromBack(ctx, region, targetM2, widthM);
  return cut !== null && cut.areaM2 > inset.areaM2 ? cut : inset;
}

/** `region` cut by a line parallel to the governing road to `targetM2`, keeping the road side. */
function cutFromBack(ctx: DesignContext, region: Region, targetM2: number, widthM: number): Plate | null {
  const edge = governingRoadEdge(ctx);
  const line = edge === null ? null : inwardLine(edge);
  if (line === null) return null;
  const towardRoad = { x: -line.n.x, y: -line.n.y };
  const part = cutToArea(region, towardRoad, widthM, targetM2 - AREA_TOLERANCE_M2, targetM2);
  return part === null ? null : plateOf(part.part);
}

function grossCap(opts: StackOptions): number {
  return opts.grossCapM2 ?? Number.POSITIVE_INFINITY;
}

/** One whole floor of a single use, or the reason there is none (and whether it is the last). */
function wholeFloor(ctx: DesignContext, at: Level, use: FloorUse): Next {
  const height = use === 'parking' ? ctx.parkingFloorToFloorM : ctx.mainFloorToFloorM;
  const topM = roundHeight(at.baseM + height);
  if (ctx.roofDeckCapM !== null && topM >= ctx.roofDeckCapM) return { floors: NONE, stop: { kind: 'cap', ruleId: ctx.capRuleId } };
  const full = clipped(ctx, at.base, topM + ctx.assumptions.parapetM, minWidthFor(use));
  const fullArea = regionArea(full);
  if (fullArea < at.minPlateM2) return { floors: NONE, stop: { kind: 'plane', ruleId: firstPlaneRule(ctx) } };
  const room = allowance(ctx, at.sums, use, grossCap(at.opts));
  const floor = (outline: Region, areaM2: number): Floor => ({ level: at.level, use, baseM: at.baseM, topM, outline, areaM2 });
  if (fullArea <= room.areaM2) return { floors: [floor(full, fullArea)], stop: null };
  const limitStop: StopReason = { kind: 'limit', ruleId: room.ruleId };
  if (room.areaM2 < at.minPlateM2) return { floors: NONE, stop: limitStop };
  const part = trimTo(ctx, full, room.areaM2, use, at.opts);
  if (part.areaM2 < at.minPlateM2) return { floors: NONE, stop: limitStop };
  return { floors: [floor(part.region, part.areaM2)], stop: limitStop };
}

/** The main-use part of a shared level, trimmed to the floor-area limits. */
function sharedMain(ctx: DesignContext, at: Level, sums: AreaSums, main: Region, mainM2: number): { readonly region: Region; readonly areaM2: number; readonly stop: StopReason | null } {
  const room = allowance(ctx, sums, ctx.mainUse, grossCap(at.opts));
  if (mainM2 <= room.areaM2) return { region: main, areaM2: mainM2, stop: null };
  const stop: StopReason = { kind: 'limit', ruleId: room.ruleId };
  if (room.areaM2 < MIN_SHARED_PART_M2) return { region: [], areaM2: 0, stop };
  const part = trimTo(ctx, main, room.areaM2, ctx.mainUse, at.opts);
  return { region: part.region, areaM2: part.areaM2, stop };
}

/**
 * A parking level holding at least `needM2` more parking. A whole parking floor while it would
 * not exceed the need by a stall or more; otherwise a shared level at the main-use height.
 */
function parkingLevel(ctx: DesignContext, at: Level, needM2: number): Next {
  const stallM2 = ctx.assumptions.parkingM2PerStall;
  const topM = roundHeight(at.baseM + ctx.mainFloorToFloorM);
  const capped = ctx.roofDeckCapM !== null && topM >= ctx.roofDeckCapM;
  const full = capped ? [] : clipped(ctx, at.base, topM + ctx.assumptions.parapetM, minWidthFor('parking'));
  if (capped || regionArea(full) < needM2 + stallM2) return wholeFloor(ctx, at, 'parking');
  const split = splitLevel(ctx, full, needM2, stallM2);
  const parkingRoom = allowance(ctx, at.sums, 'parking', grossCap(at.opts));
  if (split === null || split.parkingM2 > parkingRoom.areaM2) return wholeFloor(ctx, at, 'parking');
  const parking: Floor = { level: at.level, use: 'parking', baseM: at.baseM, topM, outline: split.parking, areaM2: split.parkingM2 };
  const afterParking = addFloor(at.sums, 'parking', split.parkingM2);
  if (at.opts.openSharedRest === true) return { floors: [parking], stop: null, plate: full };
  const main = sharedMain(ctx, at, afterParking, split.main, split.mainM2);
  if (main.areaM2 < MIN_SHARED_PART_M2) return { floors: [parking], stop: main.stop, plate: full };
  const mainFloor: Floor = { level: at.level, use: ctx.mainUse, baseM: at.baseM, topM, outline: main.region, areaM2: main.areaM2 };
  return { floors: [parking, mainFloor], stop: main.stop, plate: full };
}

export function buildStack(ctx: DesignContext, plate: Region, opts: StackOptions): Stack {
  if (!(regionArea(plate) > 0)) return { floors: [], sums: NO_AREA, stop: { kind: 'plane', ruleId: firstPlaneRule(ctx) } };
  const minPlateM2 = Math.min(MIN_VIABLE_PLATE_M2, regionArea(plate) * (1 - 1e-9));
  const maxStoreys = Math.min(MAX_STOREYS, opts.maxStoreys ?? MAX_STOREYS);
  const parkingTargetM2 = Math.max(0, opts.parkingStalls) * ctx.assumptions.parkingM2PerStall;
  const floors: Floor[] = [];
  let sums = NO_AREA;
  let base = plate;
  let baseM = 0;
  for (let level = 1; level <= maxStoreys; level++) {
    const at: Level = { base, level, baseM, sums, opts, minPlateM2 };
    const needM2 = parkingTargetM2 - sums.parking;
    const next = needM2 > 0 ? parkingLevel(ctx, at, needM2) : wholeFloor(ctx, at, ctx.mainUse);
    if (next.floors.length > 0) {
      floors.push(...next.floors);
      sums = next.floors.reduce((s, f) => addFloor(s, f.use, f.areaM2), sums);
      base = next.plate ?? next.floors[0]?.outline ?? [];
      baseM = next.floors[0]?.topM ?? baseM;
    }
    if (next.stop !== null) return { floors, sums, stop: next.stop };
  }
  return { floors, sums, stop: { kind: 'storeys', ruleId: null } };
}

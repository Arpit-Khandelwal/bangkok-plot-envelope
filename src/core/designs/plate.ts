/** Floor-plate geometry: shrinking a plate to a target area, and cutting it to a height limit. */
import { largestPiece, openFully, openRegion, regionArea, shrinkUniform, sliceAtHeight } from '../geom';
import { planeLimitAt } from '../geom/height';
import type { HeightPlane, Region, Site } from '../types';

/** Root-finding limits for the inset distance. */
const MAX_BRACKET_STEPS = 40;
const MAX_SOLVE_STEPS = 50;
/** Keep each false-position guess this far inside the bracket, so the bracket always shrinks. */
const GUESS_GUARD = 0.1;
/** Bracket width below which the search stops, in metres. */
const MIN_BRACKET_M = 1e-4;

export interface Plate {
  readonly region: Region;
  readonly areaM2: number;
}

export function plateOf(region: Region): Plate {
  return { region, areaM2: regionArea(region) };
}

type InsetFn = (t: number) => Plate;

/** The plain shrink, as one piece. */
function shrunkPlate(region: Region): InsetFn {
  return (t) => plateOf(largestPiece(shrinkUniform(region, t)));
}

/** A uniform shrink narrows the plate, so it is opened again at the minimum width. */
function openedPlate(region: Region, minWidthM: number): InsetFn {
  return (t) => plateOf(largestPiece(openRegion(shrinkUniform(region, t), minWidthM)));
}

/**
 * The largest piece of a uniform shrink of `region` (see `shrinkUniform`), with every part narrower
 * than `minWidthM` removed, whose area is at most `targetM2` and, where the geometry allows, at
 * least `targetM2 - toleranceM2`. Bisection with false-position guesses on the inset distance; the
 * result never exceeds the target. `region` itself is expected to be habitable already.
 */
export function insetToArea(region: Region, targetM2: number, toleranceM2: number, minWidthM: number): Plate {
  const start = plateOf(largestPiece(region));
  if (start.areaM2 <= targetM2) return start;
  if (!(targetM2 > 0)) return plateOf([]);
  // Most shrinks of a habitable plate stay habitable: solve on the plain shrink, which costs a
  // third as much, and open the result; solve with the opening only when that loses too much.
  const fast = solveInset(start, targetM2, toleranceM2, shrunkPlate(region));
  const opened = plateOf(largestPiece(openFully(fast.region, minWidthM)));
  if (opened.areaM2 >= targetM2 - toleranceM2 || opened.areaM2 >= fast.areaM2 - toleranceM2) return opened;
  const slow = solveInset(start, targetM2, toleranceM2, openedPlate(region, minWidthM));
  return plateOf(largestPiece(openFully(slow.region, minWidthM)));
}

/** Bisection with false-position guesses on the inset distance; see `insetToArea`. */
function solveInset(start: Plate, targetM2: number, toleranceM2: number, insetPlate: InsetFn): Plate {
  let lo = 0;
  let loArea = start.areaM2;
  let hi = Math.max(MIN_BRACKET_M, (start.areaM2 - targetM2) / Math.max(1, Math.sqrt(start.areaM2) * 4));
  let best = insetPlate(hi);
  for (let i = 0; i < MAX_BRACKET_STEPS && best.areaM2 > targetM2; i++) {
    lo = hi;
    loArea = best.areaM2;
    hi *= 2;
    best = insetPlate(hi);
  }
  if (best.areaM2 > targetM2) return plateOf([]);
  let hiArea = best.areaM2;
  for (let i = 0; i < MAX_SOLVE_STEPS; i++) {
    if (hiArea >= targetM2 - toleranceM2 || hi - lo < MIN_BRACKET_M) break;
    const span = hi - lo;
    const guess = lo + (span * (loArea - targetM2)) / Math.max(loArea - hiArea, 1e-12);
    const t = Math.min(hi - GUESS_GUARD * span, Math.max(lo + GUESS_GUARD * span, guess));
    const p = insetPlate(t);
    if (p.areaM2 <= targetM2) {
      hi = t;
      hiArea = p.areaM2;
      best = p;
    } else {
      lo = t;
      loArea = p.areaM2;
    }
  }
  return best;
}

function clearsAll(site: Site, region: Region, planes: readonly HeightPlane[], heightM: number): boolean {
  return planes.every((plane) =>
    region.every((poly) => poly.outer.every((v) => planeLimitAt(site, plane, v) >= heightM)),
  );
}

/**
 * The part of `region` where every road plane allows `heightM`, as one piece. Each plane's limit
 * is monotone in the distance from its road, so when every outer vertex clears, the whole region
 * does and it is returned unchanged.
 */
export function clipToHeight(site: Site, region: Region, planes: readonly HeightPlane[], heightM: number): Region {
  if (planes.length === 0 || clearsAll(site, region, planes, heightM)) return region;
  return largestPiece(sliceAtHeight(site, region, planes, heightM));
}

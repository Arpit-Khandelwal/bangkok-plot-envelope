/**
 * Cutting a plate with a straight line to a target area: the part beyond the line, kept habitable,
 * with the line placed by bisection. Used for the parking part of a shared level and for trimming a
 * floor whose uniform shrink would lose a narrow wing all at once.
 */
import { clipHalfPlane, openFully, openRegion, regionArea } from '../geom';
import type { Pt, Region } from '../types';

const MAX_CUT_STEPS = 60;

/**
 * The points of `region` where dir . p >= s, with every part narrower than `widthM` removed. On a
 * concave plate it may be in several pieces, all kept: the plate they come from is one piece.
 */
export function beyond(region: Region, dir: Pt, s: number, widthM: number): Region {
  return openRegion(clipHalfPlane(region, dir.x, dir.y, -s), widthM);
}

/** The range of dir . p over the region's outer corners. */
export function extent(region: Region, dir: Pt): { readonly lo: number; readonly hi: number } {
  const ds = region.flatMap((p) => p.outer.map((q) => dir.x * q.x + dir.y * q.y));
  return { lo: Math.min(...ds), hi: Math.max(...ds) };
}

/** The points of `region` where dir . p <= s: everything `beyond` leaves, before the opening. */
export function before(region: Region, dir: Pt, s: number): Region {
  return clipHalfPlane(region, -dir.x, -dir.y, s);
}

/** A part cut off by the line dir . p = offset. */
export interface Cut {
  readonly part: Region;
  readonly offset: number;
}

type PartFn = (t: number) => Region;

/** Bisection on the line offset for a part with area in [lowM2, highM2); null when none lands there. */
function bisect(region: Region, dir: Pt, part: PartFn, lowM2: number, highM2: number): Cut | null {
  let { lo, hi } = extent(region, dir);
  for (let i = 0; i < MAX_CUT_STEPS; i++) {
    const t = (lo + hi) / 2;
    const found = part(t);
    const area = regionArea(found);
    if (area < lowM2) hi = t;
    else if (area >= highM2) lo = t;
    else return { part: found, offset: t };
  }
  return null;
}

/**
 * The part of `region` beyond a line across `dir` (see `beyond`) whose area is in [lowM2, highM2),
 * the line placed by bisection; null when no line lands there. The line is first placed on the
 * plain cut, which costs a third as much, and the opening searched only when that one misses.
 */
export function cutToArea(region: Region, dir: Pt, widthM: number, lowM2: number, highM2: number): Cut | null {
  const plain = bisect(region, dir, (t) => clipHalfPlane(region, dir.x, dir.y, -t), lowM2, highM2);
  if (plain !== null) {
    const opened = openFully(plain.part, widthM);
    const area = regionArea(opened);
    if (area >= lowM2 && area < highM2) return { part: opened, offset: plain.offset };
  }
  const found = bisect(region, dir, (t) => beyond(region, dir, t, widthM), lowM2, highM2);
  return found === null ? null : { part: openFully(found.part, widthM), offset: found.offset };
}

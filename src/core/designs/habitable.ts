/**
 * Habitable floor outlines: no part of a floor may be narrower than a usable width. Every outline
 * the generator makes goes through `habitable`, so coverage, open space, the parking split, the
 * checks, the section and the massing all see the cleaned plates.
 */
import { largestPiece, minDistanceToSegment, openFully, regionArea } from '../geom';
import { m, m2 } from '../rules/format';
import type { FloorUse, Region, Site } from '../types';

/**
 * Narrowest main-use floor: a single-loaded corridor block (a 1.5 to 2 m corridor beside rooms
 * about 6 m deep) needs about 8 m. A narrower strip holds no usable rooms.
 */
export const MIN_MAIN_WIDTH_M = 8;

/**
 * Narrowest parking floor. The parking area is counted at a gross area per stall that already
 * includes the drive aisles, so the plate need not hold a full stall row plus aisle at every
 * point; but every part must at least carry a 6 m two-way drive aisle (or a ramp) so cars can
 * reach the stalls beside it. One 5 m stall row on its own is not enough: it would have no aisle.
 */
export const MIN_PARKING_WIDTH_M = 6;

/** A part of the allowed footprint left unbuilt as too narrow is mentioned above this share. */
export const NARROW_NOTE_SHARE = 0.15;

/** The removed part counts as an access strip when it reaches this close to the front of the footprint. */
const FRONT_REACH_M = 0.5;

export function minWidthFor(use: FloorUse): number {
  return use === 'parking' ? MIN_PARKING_WIDTH_M : MIN_MAIN_WIDTH_M;
}

/** The region with every part narrower than `widthM` removed, as one piece (the largest). */
export function habitable(region: Region, widthM: number): Region {
  return largestPiece(openFully(region, widthM));
}

/** What the habitable plate leaves out of the allowed footprint, for the design summary. */
export interface NarrowLoss {
  readonly removedM2: number;
  /** Share of the allowed footprint left unbuilt as too narrow. */
  readonly share: number;
  /** True when the removed part reaches the road side of the footprint, like an access strip. */
  readonly atRoad: boolean;
}

function nearestRoadGap(site: Site, region: Region): number {
  return site.edges
    .filter((e) => e.spec.kind === 'road')
    .reduce((best, e) => Math.min(best, minDistanceToSegment(region, e.from, e.to)), Number.POSITIVE_INFINITY);
}

export function narrowLoss(site: Site, footprint: Region, removed: Region): NarrowLoss {
  const footprintM2 = regionArea(footprint);
  const removedM2 = regionArea(removed);
  const share = footprintM2 > 0 ? removedM2 / footprintM2 : 0;
  if (!(share > NARROW_NOTE_SHARE)) return { removedM2, share, atRoad: false };
  const atRoad = nearestRoadGap(site, removed) <= nearestRoadGap(site, footprint) + FRONT_REACH_M;
  return { removedM2, share, atRoad };
}

/** " The narrow access strip is left open: ..." when over 15% of the allowed footprint is too narrow. */
export function narrowNote(loss: NarrowLoss): string {
  if (!(loss.share > NARROW_NOTE_SHARE)) return '';
  const what = loss.atRoad ? 'The narrow access strip is left open' : 'The narrow part of the allowed footprint is left open';
  return ` ${what}: ${m2(loss.removedM2)} of the allowed footprint is under ${m(MIN_MAIN_WIDTH_M)} wide, too narrow for a usable floor.`;
}

/**
 * The fire road and the permeable planting, measured by area (research/01-regulations.md §2.1,
 * §2.6): a 6 m fire-truck road all around a high-rise (MR 33 ข้อ 3) and permeable planting of half
 * the required open space (plan ข้อ 14(2)). Shared by the generator, which sizes the plate so both
 * fit, and by the check, so the two always read the same numbers.
 */
import { growUniform, intersection, regionArea } from '../geom';
import type { OpenSpaceRequirement, Region, Site } from '../types';

/** Width of the fire-truck road around a high-rise (MR 33 ข้อ 3). */
export const FIRE_ROAD_M = 6;
/** Share of the open space that must be permeable planting (plan clause 14(2)). */
export const PERMEABLE_SHARE = 0.5;
/** The rules whose joint demand this measures. */
export const FIRE_ROAD_RULE = 'mr33.fire-road';
export const PERMEABLE_RULE = 'plan.permeable';

/** What the open-space shares are taken of. */
export interface OpenSpaceBasis {
  readonly plotM2: number;
  readonly grossM2: number;
  readonly largestFloorM2: number;
}

function basisArea(req: OpenSpaceRequirement, basis: OpenSpaceBasis): number {
  switch (req.basis) {
    case 'plotArea':
      return basis.plotM2;
    case 'totalFloorArea':
      return basis.grossM2;
    case 'largestFloor':
      return basis.largestFloorM2;
  }
}

/** The largest open space any requirement asks for, or 0 when there is none. */
export function requiredOpenM2(reqs: readonly OpenSpaceRequirement[], basis: OpenSpaceBasis): number {
  return Math.max(0, ...reqs.map((r) => r.share * basisArea(r, basis)));
}

/** Permeable planting required: half the largest open space required. */
export function plantingRequiredM2(reqs: readonly OpenSpaceRequirement[], basis: OpenSpaceBasis): number {
  return requiredOpenM2(reqs, basis) * PERMEABLE_SHARE;
}

/** Open ground and how much of it the fire road takes, around a building covering `footprint`. */
export interface FireRoadGround {
  /** Plot area less the ground the building covers. */
  readonly openM2: number;
  /** The 6 m ring around the building, clipped to the plot, at most the open ground. */
  readonly ringM2: number;
  /** Open ground outside the ring: what is left for planting. */
  readonly leftM2: number;
}

/**
 * The ground left for planting after a 6 m ring around `footprint`, clipped to the plot. It never
 * grows when the footprint grows, so a plate can be shrunk until it is enough.
 */
export function fireRoadGround(site: Site, footprint: Region): FireRoadGround {
  const plot: Region = [{ outer: site.ring, holes: [] }];
  const openM2 = site.areaM2 - regionArea(footprint);
  const taken = regionArea(intersection(growUniform(footprint, FIRE_ROAD_M), plot));
  const leftM2 = Math.max(0, Math.min(openM2, site.areaM2 - taken));
  return { openM2, ringM2: Math.max(0, openM2 - leftM2), leftM2 };
}

/**
 * Which height rules actually shape the envelope. The roof-deck cap and the road plane measure
 * different things (DECISIONS B7): the cap stops at the roof deck, the plane reaches the highest
 * point. So the plane is compared with cap + parapet.
 */
import type { EdgeSetback, HeightPlane, Pt, Site } from '../types';

export interface HeightCap {
  readonly value: number;
  readonly ruleId: string;
}

/** Perpendicular distance from a point to the line through an edge. */
function distanceToEdgeLine(p: Pt, from: Pt, to: Pt): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - from.x, p.y - from.y);
  return Math.abs(dx * (p.y - from.y) - dy * (p.x - from.x)) / len;
}

function planeHeightAt(site: Site, plane: HeightPlane, p: Pt): number {
  const edge = site.edges[plane.edgeIndex];
  if (edge === undefined) return Number.POSITIVE_INFINITY;
  return plane.slope * (distanceToEdgeLine(p, edge.from, edge.to) + plane.rowWidthM);
}

/**
 * The plane binds when it is below cap + parapet at its own building line.
 * The cap binds when, at some plot corner, every plane allows more than cap + parapet.
 */
export function bindingHeightIds(
  site: Site,
  planes: readonly HeightPlane[],
  setbacks: readonly EdgeSetback[],
  cap: HeightCap | null,
  parapetM: number,
): readonly string[] {
  const topLimit = cap === null ? Number.POSITIVE_INFINITY : cap.value + parapetM;
  const planeIds = planes
    .filter((p) => p.slope * ((setbacks[p.edgeIndex]?.distanceM ?? 0) + p.rowWidthM) < topLimit)
    .map((p) => p.ruleId);
  const capBinds =
    cap !== null &&
    site.ring.some((corner) => planes.every((p) => planeHeightAt(site, p, corner) > topLimit));
  return cap !== null && capBinds ? [...planeIds, cap.ruleId] : planeIds;
}

/**
 * The last parking level is shared: its plate is cut by a straight line parallel to the governing
 * road, parking at the back and main use at the road side. The cut is placed by bisection so the
 * parking part is at least the area still needed and less than one stall more. Each part is kept
 * habitable (see `habitable.ts`); on a concave level a part may be in several pieces. When that
 * cut would leave a part too narrow to use, the level is cut across instead (see `parkingCuts`).
 */
import { clipHalfPlane, openFully, regionArea, union } from '../geom';
import type { Pt, Region } from '../types';
import type { DesignContext } from './context';
import { before, beyond, cutToArea } from './cut';
import { MIN_MAIN_WIDTH_M, MIN_PARKING_WIDTH_M } from './habitable';
import { governingRoadEdge, inwardLine } from './road-edge';

/**
 * Depth of a back-corner parking part: a metre over the narrowest parking floor, so that the part
 * is not cut at exactly the width the opening tests and comes out the same under every opening.
 */
const CORNER_DEPTH_M = MIN_PARKING_WIDTH_M + 1;
/** The smallest parking part worth cutting: a corner as long as it is deep. A smaller need gets this. */
const MIN_PARKING_PART_M2 = CORNER_DEPTH_M * CORNER_DEPTH_M;

export interface SplitLevel {
  readonly parking: Region;
  readonly parkingM2: number;
  readonly main: Region;
  readonly mainM2: number;
}

/**
 * A parking part and the rest of the level, taken on the other side of the cut lines (not as a
 * boolean difference, which can misplace a part that touches the level only at a corner).
 */
interface Parted {
  readonly parking: Region;
  readonly rest: Region;
}

/** The level split this way, the main use being the habitable rest. */
function withParking(parted: Parted): SplitLevel {
  const main = openFully(parted.rest, MIN_MAIN_WIDTH_M);
  return { parking: parted.parking, parkingM2: regionArea(parted.parking), main, mainM2: regionArea(main) };
}

/** The plate's back edge: of the edges at least a corner deep, the one farthest from the road. */
function backEdge(full: Region, n: Pt): { readonly inward: Pt; readonly along: Pt; readonly k: number } | null {
  let best: { readonly inward: Pt; readonly along: Pt; readonly k: number; readonly depth: number } | null = null;
  for (const poly of full) {
    const ring = poly.outer;
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length] ?? a;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < CORNER_DEPTH_M) return;
      const depth = (n.x * (a.x + b.x) + n.y * (a.y + b.y)) / 2;
      if (best !== null && depth <= best.depth) return;
      // Outer rings run counter-clockwise, so the inward normal is the edge turned left.
      const inward = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
      best = { inward, along: { x: (b.x - a.x) / len, y: (b.y - a.y) / len }, k: inward.x * a.x + inward.y * a.y, depth };
    });
  }
  return best;
}

/**
 * Ways to cut the parking off the level, best first: a strip across the back; one end of the level
 * along the road; for a small need, a corner of the strip along the plate's back edge, a little
 * deeper than a parking floor must be wide.
 */
function parkingCuts(full: Region, n: Pt, needM2: number, stallM2: number): ReadonlyArray<() => Parted | null> {
  const upperM2 = Math.max(needM2 + stallM2, MIN_PARKING_PART_M2);
  const across = (dir: Pt): Parted | null => {
    const found = cutToArea(full, dir, MIN_PARKING_WIDTH_M, needM2, upperM2);
    return found === null ? null : { parking: found.part, rest: before(full, dir, found.offset) };
  };
  const edge = backEdge(full, n);
  const corner = (sign: number): Parted | null => {
    if (edge === null) return null;
    const toBack = { x: -edge.inward.x, y: -edge.inward.y };
    const line = -(edge.k + CORNER_DEPTH_M);
    const strip = beyond(full, toBack, line, MIN_PARKING_WIDTH_M);
    const dir = { x: sign * edge.along.x, y: sign * edge.along.y };
    const found = cutToArea(strip, dir, MIN_PARKING_WIDTH_M, needM2, upperM2);
    if (found === null) return null;
    const rawStrip = clipHalfPlane(full, toBack.x, toBack.y, -line);
    return { parking: found.part, rest: union(before(full, toBack, line), before(rawStrip, dir, found.offset)) };
  };
  return [() => across(n), () => across({ x: n.y, y: -n.x }), () => across({ x: -n.y, y: n.x }), () => corner(1), () => corner(-1)];
}

/**
 * Splits `full` so the parking part is in [needM2, needM2 + stallM2) and the main use is the
 * habitable rest. The first cut that loses less than a stall's area to the opening is taken, else
 * the one keeping the most main use. Null when there is no road edge to cut against or no cut
 * lands in the window.
 */
export function splitLevel(ctx: DesignContext, full: Region, needM2: number, stallM2: number): SplitLevel | null {
  const edge = governingRoadEdge(ctx);
  const line = edge === null ? null : inwardLine(edge);
  if (line === null) return null;
  const fullM2 = regionArea(full);
  let best: SplitLevel | null = null;
  for (const cut of parkingCuts(full, line.n, needM2, stallM2)) {
    const parted = cut();
    if (parted === null) continue;
    const split = withParking(parted);
    if (fullM2 - split.parkingM2 - split.mainM2 < stallM2) return split;
    if (best === null || split.mainM2 > best.mainM2) best = split;
  }
  return best;
}

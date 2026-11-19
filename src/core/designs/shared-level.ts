/**
 * The last parking level is shared: its plate is cut by a straight line parallel to the governing
 * road, parking at the back and main use at the road side. The cut is placed by bisection so the
 * parking part is at least the area still needed and less than one stall more.
 */
import { clipHalfPlane, regionArea } from '../geom';
import type { Pt, Region } from '../types';
import type { DesignContext } from './context';
import { governingRoadEdge, inwardLine } from './road-edge';

const MAX_CUT_STEPS = 60;

export interface SplitLevel {
  readonly parking: Region;
  readonly parkingM2: number;
  readonly main: Region;
  readonly mainM2: number;
}

/** Parking where d >= t (the back). On a concave plate it may be in several pieces. */
function backOf(full: Region, n: Pt, k: number, t: number): Region {
  return clipHalfPlane(full, n.x, n.y, -(k + t));
}

/** Main use where d <= t (the road side); with the back, the whole level. */
function frontOf(full: Region, n: Pt, k: number, t: number): Region {
  return clipHalfPlane(full, -n.x, -n.y, k + t);
}

/**
 * Splits `full` so the parking part is in [needM2, needM2 + stallM2). Null when there is no road
 * edge to cut against or the bisection cannot land in the window.
 */
export function splitLevel(ctx: DesignContext, full: Region, needM2: number, stallM2: number): SplitLevel | null {
  const edge = governingRoadEdge(ctx);
  const line = edge === null ? null : inwardLine(edge);
  if (line === null) return null;
  const { n, k } = line;
  const ds = full.flatMap((p) => p.outer.map((q) => n.x * q.x + n.y * q.y - k));
  let lo = Math.min(...ds);
  let hi = Math.max(...ds);
  for (let i = 0; i < MAX_CUT_STEPS; i++) {
    const t = (lo + hi) / 2;
    const back = backOf(full, n, k, t);
    const backM2 = regionArea(back);
    if (backM2 < needM2) hi = t;
    else if (backM2 >= needM2 + stallM2) lo = t;
    else {
      const front = frontOf(full, n, k, t);
      return { parking: back, parkingM2: backM2, main: front, mainM2: regionArea(front) };
    }
  }
  return null;
}

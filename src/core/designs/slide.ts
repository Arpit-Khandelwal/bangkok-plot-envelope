/**
 * Slides a tower's plate toward the governing road, within the allowed footprint, to meet the
 * Bangkok ordinance ข้อ 53 (a façade facing the road within 20 m of it). The smallest slide that
 * meets ข้อ 53 is taken, since every metre toward the road lowers the height plane over the tower;
 * the floors are then stacked afresh on the moved plate, so they still clear the plane.
 */
import { difference, regionArea } from '../geom';
import { frontAccess, meetsClause53 } from '../measure/front-access';
import type { Pt, Region } from '../types';
import type { DesignContext } from './context';
import { generateOnFixedPlate } from './generate';
import type { Generated, VariantOptions } from './generate';
import { governingRoadEdge, inwardLine } from './road-edge';

/** A moved plate may stick out of the allowed footprint by this much (clipping grid). */
const CONTAIN_TOLERANCE_M2 = 0.05;
/** Slides are found to within this distance. */
const SLIDE_PRECISION_M = 0.05;

function translate(region: Region, v: Pt): Region {
  const move = (p: Pt): Pt => ({ x: p.x + v.x, y: p.y + v.y });
  return region.map((poly) => ({ outer: poly.outer.map(move), holes: poly.holes.map((h) => h.map(move)) }));
}

/** Largest t in [lo, hi] for which `ok(t)` holds, assuming it holds on [lo, t*] only. */
function lastTrue(ok: (t: number) => boolean, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  if (ok(b)) return b;
  while (b - a > SLIDE_PRECISION_M) {
    const mid = (a + b) / 2;
    if (ok(mid)) a = mid;
    else b = mid;
  }
  return a;
}

/** Smallest t in [lo, hi] for which `ok(t)` holds, given ok(hi). */
function firstTrue(ok: (t: number) => boolean, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  while (b - a > SLIDE_PRECISION_M) {
    const mid = (a + b) / 2;
    if (ok(mid)) b = mid;
    else a = mid;
  }
  return b;
}

/** The design on the plate moved toward the road just far enough to meet ข้อ 53, or null if it cannot. */
export function slideTowardRoad(ctx: DesignContext, g: Generated, opts: VariantOptions): Generated | null {
  if (meetsClause53(frontAccess(ctx.site, g.plate))) return null;
  const edge = governingRoadEdge(ctx);
  const line = edge === null ? null : inwardLine(edge);
  if (line === null) return null;
  const toward = { x: -line.n.x, y: -line.n.y };
  const at = (t: number): Region => translate(g.plate, { x: toward.x * t, y: toward.y * t });
  const inside = (t: number): boolean => regionArea(difference(at(t), ctx.basePlate)) <= CONTAIN_TOLERANCE_M2;
  const depths = g.plate.flatMap((p) => p.outer.map((q) => line.n.x * q.x + line.n.y * q.y - line.k));
  const maxSlide = lastTrue(inside, 0, Math.max(0, Math.min(...depths)));
  const meets = (t: number): boolean => meetsClause53(frontAccess(ctx.site, at(t)));
  if (!(maxSlide > 0) || !meets(maxSlide)) return null;
  return generateOnFixedPlate(ctx, at(firstTrue(meets, 0, maxSlide)), opts);
}

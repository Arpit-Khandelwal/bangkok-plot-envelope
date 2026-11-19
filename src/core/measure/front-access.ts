/**
 * Measurements for the Bangkok ordinance B.E. 2544 ข้อ 53 (research/01-regulations.md §3.4): the
 * part of the building's outline that faces a public road, and how near the building comes to it.
 * Shared by the check and by the slender tower's placement, so both read the same numbers.
 */
import { minDistanceToSegment } from '../geom';
import type { EdgeInfo, Pt, Region, Site } from '../types';

/** The façade must lie within this distance of the public way (ข้อ 53). */
export const FRONT_FACADE_MAX_M = 20;
/** The façade facing the road must exceed this share of the external perimeter (ข้อ 53). */
export const FRONT_FACADE_SHARE = 1 / 8;
/** An outline segment within this angle of a road edge counts as roughly parallel to it. */
export const FACING_ANGLE_DEG = 30;

export interface FrontAccess {
  /** Shortest distance from the building to a road edge. */
  readonly nearestM: number;
  /** Length of outline facing a road: on the road side, within 20 m and roughly parallel. */
  readonly facingM: number;
  /** External perimeter of the building's outline (outer rings only). */
  readonly perimeterM: number;
}

function roadEdges(site: Site): readonly EdgeInfo[] {
  return site.edges.filter((e) => e.spec.kind === 'road' && e.lengthM > 0);
}

/** The part of [lo, hi] where a + b t lies in [min, max]. */
function clampInterval(lo: number, hi: number, a: number, b: number, min: number, max: number): readonly [number, number] {
  if (Math.abs(b) < 1e-12) return a >= min && a <= max ? [lo, hi] : [1, 0];
  const t1 = (min - a) / b;
  const t2 = (max - a) / b;
  return [Math.max(lo, Math.min(t1, t2)), Math.min(hi, Math.max(t1, t2))];
}

/** Length of segment p-q that faces road edge e (outer rings run counter-clockwise). */
function facingLength(p: Pt, q: Pt, e: EdgeInfo): number {
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  if (!(len > 0)) return 0;
  const ex = (e.to.x - e.from.x) / e.lengthM;
  const ey = (e.to.y - e.from.y) / e.lengthM;
  // Road inward normal (into the plot) and the segment's outward normal must point at each other.
  const inward = { x: -ey, y: ex };
  const outward = { x: (q.y - p.y) / len, y: -(q.x - p.x) / len };
  const facing = -(outward.x * inward.x + outward.y * inward.y);
  if (facing < Math.cos((FACING_ANGLE_DEG * Math.PI) / 180)) return 0;
  const rel = (pt: Pt): Pt => ({ x: pt.x - e.from.x, y: pt.y - e.from.y });
  const dp = rel(p);
  const dq = rel(q);
  const depthP = dp.x * inward.x + dp.y * inward.y;
  const depthQ = dq.x * inward.x + dq.y * inward.y;
  const alongP = dp.x * ex + dp.y * ey;
  const alongQ = dq.x * ex + dq.y * ey;
  const [a0, a1] = clampInterval(0, 1, depthP, depthQ - depthP, 0, FRONT_FACADE_MAX_M);
  const [b0, b1] = clampInterval(a0, a1, alongP, alongQ - alongP, 0, e.lengthM);
  return b1 > b0 ? (b1 - b0) * len : 0;
}

export function frontAccess(site: Site, footprint: Region): FrontAccess {
  const roads = roadEdges(site);
  const nearestM = roads.reduce((best, e) => Math.min(best, minDistanceToSegment(footprint, e.from, e.to)), Number.POSITIVE_INFINITY);
  let facingM = 0;
  let perimeterM = 0;
  for (const poly of footprint) {
    const ring = poly.outer;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i] as Pt;
      const q = ring[(i + 1) % ring.length] as Pt;
      perimeterM += Math.hypot(q.x - p.x, q.y - p.y);
      facingM += roads.reduce((best, e) => Math.max(best, facingLength(p, q, e)), 0);
    }
  }
  return { nearestM, facingM, perimeterM };
}

/** True when the outline meets ข้อ 53: near enough to a road, with more than 1/8 of it facing one. */
export function meetsClause53(m: FrontAccess): boolean {
  return m.nearestM <= FRONT_FACADE_MAX_M && m.facingM > FRONT_FACADE_SHARE * m.perimeterM;
}

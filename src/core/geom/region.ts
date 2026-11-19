/**
 * Boolean operations on `Region` (metres), backed by clipper2-ts on a 1 mm integer grid
 * (see tolerance.ts). Every result has its vertices on that grid, outer rings CCW and
 * holes CW, and pieces or holes under SLIVER_AREA_M2 removed. Inputs are never mutated.
 * Overlapping polygons within one input region are treated as their union.
 */
import { EndType, inflatePaths, JoinType } from 'clipper2-ts';
import type { Path64, Paths64 } from 'clipper2-ts';
import type { Polygon, Pt, Region, Ring } from '../types';
import { capsule } from './capsule';
import { booleanPaths, regionToPaths } from './clipper-io';
import type { BoolOp } from './clipper-io';
import { pointInRing, segmentDistance, signedArea } from './ring';
import { ARC_TOLERANCE_M, CLIPPER_SCALE, SLIVER_AREA_M2 } from './tolerance';

/** Extra room around the region when building a half-plane clip polygon. */
const HALF_PLANE_MARGIN_M = 10;

function run(op: BoolOp, a: Region, b: Region, minArea: number): Region {
  return booleanPaths(op, regionToPaths(a), regionToPaths(b), minArea);
}

/** Union of two regions (also dissolves overlaps within each). */
export function union(a: Region, b: Region = []): Region {
  return run('union', a, b, SLIVER_AREA_M2);
}

/** Union of many regions in one pass. */
export function unionAll(regions: readonly Region[]): Region {
  return booleanPaths('union', regions.flatMap(regionToPaths), [], SLIVER_AREA_M2);
}

/** Points of a that are not in b. */
export function difference(a: Region, b: Region): Region {
  return run('difference', a, b, SLIVER_AREA_M2);
}

export function intersection(a: Region, b: Region): Region {
  return run('intersection', a, b, SLIVER_AREA_M2);
}

/** Snap to the grid and dissolve overlaps without dropping slivers. */
export function normalizeRaw(region: Region): Region {
  return run('union', region, [], 0);
}

/** Every outer and hole ring of a region. */
export function regionRings(region: Region): Ring[] {
  return region.flatMap((p) => [p.outer, ...p.holes]);
}

/** Rings as capsule polygons, one per boundary edge. */
function boundaryCapsules(region: Region, distanceM: number): Paths64 {
  const paths: Paths64 = [];
  for (const ring of regionRings(region)) {
    for (let i = 0; i < ring.length; i++) {
      const caps = capsule(ring[i] as Pt, ring[(i + 1) % ring.length] as Pt, distanceM, ARC_TOLERANCE_M);
      if (caps.length > 0) paths.push(toPath(caps));
    }
  }
  return paths;
}

function toPath(ring: readonly Pt[]): Path64 {
  return ring.map((p) => ({ x: Math.round(p.x * CLIPPER_SCALE), y: Math.round(p.y * CLIPPER_SCALE) }));
}

/**
 * Shrink a region: keep the points at least `distanceM` from its boundary (true
 * Euclidean distance, round at reflex corners, conservative by at most the arc
 * tolerance). May return several pieces or none. distance <= 0 returns the region snapped.
 */
export function insetUniform(region: Region, distanceM: number): Region {
  if (!(distanceM > 0)) return union(region);
  if (!Number.isFinite(distanceM)) return [];
  const strip = booleanPaths('union', boundaryCapsules(region, distanceM), [], 0);
  return difference(region, strip);
}

/** Miter limit for `shrinkUniform`, as a multiple of the distance. */
const SHRINK_MITER_LIMIT = 2;

/**
 * Fast uniform shrink for sizing floor plates: a clipper offset by -distanceM with mitred
 * corners, clipped back to the region so the result is always inside it. Unlike `insetUniform`
 * it rounds nothing and costs one offset instead of a union of one capsule per edge, so it suits
 * repeated use in a search; it is not an exact Euclidean setback at reflex corners.
 */
export function shrinkUniform(region: Region, distanceM: number): Region {
  if (!(distanceM > 0)) return union(region);
  if (!Number.isFinite(distanceM)) return [];
  const paths = regionToPaths(region);
  const shrunk = inflatePaths(paths, -distanceM * CLIPPER_SCALE, JoinType.Miter, EndType.Polygon, SHRINK_MITER_LIMIT);
  if (shrunk.length === 0) return [];
  return booleanPaths('intersection', shrunk, paths, SLIVER_AREA_M2);
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function regionBounds(region: Region): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of regionRings(region)) {
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return minX <= maxX ? { minX, minY, maxX, maxY } : null;
}

/** Convex polygon: the bounds rectangle clipped to a*x + b*y + c >= 0 (Sutherland-Hodgman). */
function halfPlanePolygon(bounds: Bounds, a: number, b: number, c: number): Pt[] {
  const m = HALF_PLANE_MARGIN_M;
  const rect: Pt[] = [
    { x: bounds.minX - m, y: bounds.minY - m },
    { x: bounds.maxX + m, y: bounds.minY - m },
    { x: bounds.maxX + m, y: bounds.maxY + m },
    { x: bounds.minX - m, y: bounds.maxY + m },
  ];
  const f = (p: Pt): number => a * p.x + b * p.y + c;
  const out: Pt[] = [];
  for (let i = 0; i < rect.length; i++) {
    const p = rect[i] as Pt;
    const q = rect[(i + 1) % rect.length] as Pt;
    const fp = f(p);
    const fq = f(q);
    if (fp >= 0) out.push(p);
    if (fp >= 0 !== fq >= 0) {
      const t = fp / (fp - fq);
      out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
  }
  return out;
}

/** The half-plane a*x + b*y + c >= 0, bounded to cover `region`; null when it covers all. */
function halfPlaneRegion(region: Region, a: number, b: number, c: number): Region | null {
  const bounds = regionBounds(region);
  if (!bounds) return [];
  const len = Math.hypot(a, b);
  if (!(len > 0) || !Number.isFinite(len)) return c >= 0 ? null : [];
  const [na, nb, nc] = [a / len, b / len, c / len];
  const corners = [
    na * bounds.minX + nb * bounds.minY + nc,
    na * bounds.maxX + nb * bounds.minY + nc,
    na * bounds.maxX + nb * bounds.maxY + nc,
    na * bounds.minX + nb * bounds.maxY + nc,
  ];
  if (Math.min(...corners) >= 0) return null;
  if (Math.max(...corners) <= 0) return [];
  return [{ outer: halfPlanePolygon(bounds, na, nb, nc), holes: [] }];
}

/**
 * Keep the points of `region` where a*x + b*y + c >= 0. Exact for concave rings and
 * holes (a boolean intersection with a bounded half-plane polygon).
 */
export function clipHalfPlane(region: Region, a: number, b: number, c: number): Region {
  const hp = halfPlaneRegion(region, a, b, c);
  if (hp === null) return union(region);
  if (hp.length === 0) return [];
  return intersection(region, hp);
}

export function polygonArea(poly: Polygon): number {
  let s = Math.abs(signedArea(poly.outer));
  for (const h of poly.holes) s -= Math.abs(signedArea(h));
  return s;
}

/** Total area in m2, holes subtracted. Assumes polygons do not overlap (true for results here). */
export function regionArea(region: Region): number {
  return region.reduce((s, p) => s + polygonArea(p), 0);
}

/** The single largest polygon, as a region (empty when the region is empty). */
export function largestPiece(region: Region): Region {
  let best: Polygon | null = null;
  let bestArea = -Infinity;
  for (const p of region) {
    const a = polygonArea(p);
    if (a > bestArea) {
      best = p;
      bestArea = a;
    }
  }
  return best ? [best] : [];
}

export function pointInPolygon(p: Pt, poly: Polygon): boolean {
  return pointInRing(p, poly.outer) && !poly.holes.some((h) => pointInRing(p, h));
}

export function pointInRegion(p: Pt, region: Region): boolean {
  return region.some((poly) => pointInPolygon(p, poly));
}

/** Smallest distance from any point of the region to segment ab (0 if they meet). */
export function minDistanceToSegment(region: Region, a: Pt, b: Pt): number {
  if (region.length === 0) return Infinity;
  if (pointInRegion(a, region) || pointInRegion(b, region)) return 0;
  let best = Infinity;
  for (const ring of regionRings(region)) {
    for (let i = 0; i < ring.length; i++) {
      best = Math.min(best, segmentDistance(a, b, ring[i] as Pt, ring[(i + 1) % ring.length] as Pt));
      if (best === 0) return 0;
    }
  }
  return best;
}

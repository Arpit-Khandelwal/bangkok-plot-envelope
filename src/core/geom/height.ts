import type { HeightPlane, Pt, Region, Site } from '../types';
import { clipHalfPlane, union } from './region';
import { signedDistanceToLine } from './ring';

/** A linear height function z = a*x + b*y + c over local metres. */
export interface LinearFn {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

/** True when a plane is usable: known edge, finite non-negative slope and width. */
export function isValidPlane(site: Site, plane: HeightPlane): boolean {
  return (
    Number.isInteger(plane.edgeIndex) &&
    plane.edgeIndex >= 0 &&
    plane.edgeIndex < site.edges.length &&
    Number.isFinite(plane.slope) &&
    plane.slope >= 0 &&
    Number.isFinite(plane.rowWidthM) &&
    plane.rowWidthM >= 0
  );
}

function edgeOf(site: Site, plane: HeightPlane): { readonly from: Pt; readonly to: Pt } {
  const n = site.ring.length;
  return { from: site.ring[plane.edgeIndex] as Pt, to: site.ring[(plane.edgeIndex + 1) % n] as Pt };
}

/**
 * The plane as z = a*x + b*y + c, i.e. slope * (signed inward distance to the edge's
 * line + rowWidthM). This equals the height limit only where that distance is >= 0;
 * beyond the line (possible on concave plots) the limit is clamped at slope * rowWidthM.
 */
export function planeCoefficients(site: Site, plane: HeightPlane): LinearFn {
  const { from, to } = edgeOf(site, plane);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return { a: 0, b: 0, c: plane.slope * plane.rowWidthM };
  const k = plane.slope / len;
  return { a: -k * dy, b: k * dx, c: k * (dy * from.x - dx * from.y) + plane.slope * plane.rowWidthM };
}

/** The clamp floor of a plane: its height limit on or beyond the edge line. */
export function planeFloor(plane: HeightPlane): number {
  return plane.slope * plane.rowWidthM;
}

/** Height limit of one plane at p: slope * (max(0, inward distance) + rowWidthM). */
export function planeLimitAt(site: Site, plane: HeightPlane, p: Pt): number {
  const { from, to } = edgeOf(site, plane);
  return plane.slope * (Math.max(0, signedDistanceToLine(p, from, to)) + plane.rowWidthM);
}

/**
 * Lowest of all plane limits and the flat cap at p. Infinity when there are no planes
 * and no cap. Invalid planes (unknown edge, negative or non-finite slope or width) give NaN
 * so that the caller cannot mistake them for "no limit".
 */
export function heightLimitAt(site: Site, planes: readonly HeightPlane[], capM: number | null, p: Pt): number {
  let h = capM ?? Infinity;
  for (const plane of planes) {
    if (!isValidPlane(site, plane)) return Number.NaN;
    h = Math.min(h, planeLimitAt(site, plane, p));
  }
  return h;
}

/**
 * The part of the footprint where every plane's limit is >= z. For each plane the
 * condition is either always true (its clamp floor reaches z) or a half-plane
 * slope*(d + w) >= z, so the result is a sequence of exact half-plane clips.
 * The flat cap is not applied here. Invalid planes give an empty region.
 */
export function sliceAtHeight(site: Site, footprint: Region, planes: readonly HeightPlane[], z: number): Region {
  let r = union(footprint);
  for (const plane of planes) {
    if (r.length === 0) return r;
    if (!isValidPlane(site, plane)) return [];
    if (planeFloor(plane) >= z) continue;
    if (plane.slope <= 0) return [];
    const f = planeCoefficients(site, plane);
    r = clipHalfPlane(r, f.a, f.b, f.c - z);
  }
  return r;
}

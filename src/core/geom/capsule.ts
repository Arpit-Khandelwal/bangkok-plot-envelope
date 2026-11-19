import type { Pt } from '../types';
import { ARC_TOLERANCE_M } from './tolerance';

/** Fewest arc segments per half circle, so tiny radii still give a sensible shape. */
const MIN_ARC_SEGMENTS = 2;
/** Most arc segments per half circle, which bounds cost for very large radii. */
const MAX_ARC_SEGMENTS = 64;

/** Number of segments per half circle so a circumscribed polygon overshoots by <= tolerance. */
export function arcSegments(radius: number, tolerance: number = ARC_TOLERANCE_M): number {
  if (!(radius > 0)) return MIN_ARC_SEGMENTS;
  // Circumscribed polygon with step theta: vertex radius r / cos(theta / 2) <= r + tol.
  const halfStep = Math.acos(radius / (radius + tolerance));
  const n = Math.ceil(Math.PI / (2 * halfStep));
  return Math.max(MIN_ARC_SEGMENTS, Math.min(MAX_ARC_SEGMENTS, n));
}

function arc(centre: Pt, radius: number, startAngle: number, segments: number, out: Pt[]): void {
  const step = Math.PI / segments;
  const r = radius / Math.cos(step / 2);
  out.push({ x: centre.x + radius * Math.cos(startAngle), y: centre.y + radius * Math.sin(startAngle) });
  for (let j = 0; j < segments; j++) {
    const ang = startAngle + (j + 0.5) * step;
    out.push({ x: centre.x + r * Math.cos(ang), y: centre.y + r * Math.sin(ang) });
  }
  const end = startAngle + Math.PI;
  out.push({ x: centre.x + radius * Math.cos(end), y: centre.y + radius * Math.sin(end) });
}

/**
 * Counter-clockwise polygon that contains every point within `radius` of segment ab
 * (a stadium). The straight sides are exact; the round ends circumscribe the true arcs,
 * overshooting by at most the arc tolerance, so the shape is never smaller than the
 * true set. Returns [] when radius <= 0 or the input is not finite.
 */
export function capsule(a: Pt, b: Pt, radius: number, tolerance: number = ARC_TOLERANCE_M): Pt[] {
  if (!(radius > 0) || !Number.isFinite(radius)) return [];
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return [];
  const segments = arcSegments(radius, tolerance);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Direction angle of the segment; a zero-length segment gives a disc.
  const dir = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx);
  const out: Pt[] = [];
  // Right side runs a -> b at angle dir - 90deg; end cap around b; left side back; cap around a.
  arc(b, radius, dir - Math.PI / 2, segments, out);
  arc(a, radius, dir + Math.PI / 2, segments, out);
  return out;
}

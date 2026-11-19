/**
 * Directions of groups of segments, taken as axes (a segment and its reverse have the same axis).
 * Used to tell the length of a road frontage from a step across it.
 */
import type { Pt } from '../types';

export interface Segment {
  readonly from: Pt;
  readonly to: Pt;
}

/**
 * Length-weighted dominant axis of the segments, as a unit vector. Angles are doubled before
 * averaging so that reversed segments reinforce rather than cancel. When the average vanishes
 * (equal lengths at right angles), the longest segment's direction is used. Null when every
 * segment has zero length.
 */
export function dominantAxis(segments: readonly Segment[]): Pt | null {
  let c = 0;
  let s = 0;
  let longest: Segment | null = null;
  let longestLen = 0;
  for (const seg of segments) {
    const dx = seg.to.x - seg.from.x;
    const dy = seg.to.y - seg.from.y;
    const len = Math.hypot(dx, dy);
    if (!(len > 0)) continue;
    const a = Math.atan2(dy, dx);
    c += len * Math.cos(2 * a);
    s += len * Math.sin(2 * a);
    if (len > longestLen) {
      longestLen = len;
      longest = seg;
    }
  }
  if (longest === null) return null;
  if (Math.hypot(c, s) <= 1e-9 * longestLen) {
    return { x: (longest.to.x - longest.from.x) / longestLen, y: (longest.to.y - longest.from.y) / longestLen };
  }
  const half = Math.atan2(s, c) / 2;
  return { x: Math.cos(half), y: Math.sin(half) };
}

/** Angle in degrees, 0 to 90, between a segment's axis and a unit axis. 0 for a zero-length segment. */
export function axisAngleDeg(seg: Segment, axis: Pt): number {
  const dx = seg.to.x - seg.from.x;
  const dy = seg.to.y - seg.from.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return 0;
  const cos = Math.min(1, Math.abs(dx * axis.x + dy * axis.y) / len);
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Angle in degrees, 0 to 90, between two unit axes. */
export function axesAngleDeg(a: Pt, b: Pt): number {
  const cos = Math.min(1, Math.abs(a.x * b.x + a.y * b.y));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Smallest and largest projection of the points onto a unit axis. */
export function extentAlong(points: readonly Pt[], axis: Pt): { readonly min: number; readonly max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    const t = p.x * axis.x + p.y * axis.y;
    min = Math.min(min, t);
    max = Math.max(max, t);
  }
  return { min, max };
}

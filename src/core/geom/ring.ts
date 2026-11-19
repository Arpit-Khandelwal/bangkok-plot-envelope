import type { Pt, Ring } from '../types';

/** Shoelace signed area: positive for a counter-clockwise ring. */
export function signedArea(ring: Ring): number {
  const n = ring.length;
  if (n < 3) return 0;
  // Translate to the first point to limit cancellation for far-off coordinates.
  const o = ring[0] as Pt;
  let s = 0;
  for (let i = 1; i < n - 1; i++) {
    const a = ring[i] as Pt;
    const b = ring[i + 1] as Pt;
    s += (a.x - o.x) * (b.y - o.y) - (b.x - o.x) * (a.y - o.y);
  }
  return s / 2;
}

export function perimeter(ring: Ring): number {
  const n = ring.length;
  if (n < 2) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i] as Pt;
    const b = ring[(i + 1) % n] as Pt;
    s += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return s;
}

/** Area centroid. Falls back to the vertex average when the ring has no area. */
export function centroid(ring: Ring): Pt {
  const n = ring.length;
  if (n === 0) return { x: 0, y: 0 };
  const o = ring[0] as Pt;
  let cx = 0;
  let cy = 0;
  let a2 = 0;
  for (let i = 0; i < n; i++) {
    const p = ring[i] as Pt;
    const q = ring[(i + 1) % n] as Pt;
    const px = p.x - o.x;
    const py = p.y - o.y;
    const qx = q.x - o.x;
    const qy = q.y - o.y;
    const c = px * qy - qx * py;
    a2 += c;
    cx += (px + qx) * c;
    cy += (py + qy) * c;
  }
  if (Math.abs(a2) < 1e-12) {
    let sx = 0;
    let sy = 0;
    for (const p of ring) {
      sx += p.x;
      sy += p.y;
    }
    return { x: sx / n, y: sy / n };
  }
  return { x: o.x + cx / (3 * a2), y: o.y + cy / (3 * a2) };
}

/**
 * Indices of the points kept after merging consecutive points closer than `tolerance`
 * (including the last point against the first). The first point of each run is kept.
 */
export function dedupeIndices(ring: Ring, tolerance = 0): number[] {
  const kept: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i] as Pt;
    const lastIndex = kept[kept.length - 1];
    if (lastIndex !== undefined && dist(ring[lastIndex] as Pt, p) <= tolerance) continue;
    kept.push(i);
  }
  while (kept.length > 1) {
    const first = ring[kept[0] as number] as Pt;
    const last = ring[kept[kept.length - 1] as number] as Pt;
    if (dist(first, last) > tolerance) break;
    kept.pop();
  }
  return kept;
}

/** Ring without consecutive (cyclic) duplicate points. */
export function removeDuplicatePoints(ring: Ring, tolerance = 0): Pt[] {
  return dedupeIndices(ring, tolerance).map((i) => ring[i] as Pt);
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Distance from p to the segment ab. */
export function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Signed distance from p to the infinite line through a and b: positive to the left of
 * the direction a -> b (inward for an edge of a counter-clockwise ring). 0 if a == b.
 */
export function signedDistanceToLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 0;
  return (dx * (p.y - a.y) - dy * (p.x - a.x)) / len;
}

function orient(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Minimum distance between segments ab and cd (0 when they cross or touch). */
export function segmentDistance(a: Pt, b: Pt, c: Pt, d: Pt): number {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return 0;
  return Math.min(distanceToSegment(c, a, b), distanceToSegment(d, a, b), distanceToSegment(a, c, d), distanceToSegment(b, c, d));
}

/**
 * True when the ring does not cross or touch itself: non-adjacent edges stay more than
 * `tolerance` apart, and no edge folds back onto its neighbour (a spike). Straight-through
 * collinear corners are fine. Rings with fewer than 3 points are not simple.
 */
export function isSimple(ring: Ring, tolerance = 0): boolean {
  const n = ring.length;
  if (n < 3) return false;
  const at = (i: number): Pt => ring[((i % n) + n) % n] as Pt;
  for (let i = 0; i < n; i++) {
    const prev = at(i - 1);
    const v = at(i);
    const next = at(i + 1);
    if (dist(prev, v) === 0) return false;
    // Spike: the two edges at v overlap when they point in opposite directions along one line.
    const crossV = orient(prev, v, next);
    const dot = (prev.x - v.x) * (next.x - v.x) + (prev.y - v.y) * (next.y - v.y);
    const scale = dist(prev, v) * dist(v, next);
    if (dot > 0 && Math.abs(crossV) <= Math.max(tolerance * Math.max(dist(prev, v), dist(v, next)), 1e-12 * scale)) {
      return false;
    }
  }
  // Sweep over edges sorted by their left end; only pairs whose x-ranges overlap
  // (within the tolerance) can touch.
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (i, j) => Math.min(at(i).x, at(i + 1).x) - Math.min(at(j).x, at(j + 1).x),
  );
  for (let oi = 0; oi < n; oi++) {
    const i = order[oi] as number;
    const a = at(i);
    const b = at(i + 1);
    const maxX = Math.max(a.x, b.x) + tolerance;
    for (let oj = oi + 1; oj < n; oj++) {
      const j = order[oj] as number;
      const c = at(j);
      const d = at(j + 1);
      if (Math.min(c.x, d.x) > maxX) break;
      const gap = Math.abs(i - j);
      if (gap <= 1 || gap === n - 1) continue; // adjacent edges
      if (segmentDistance(a, b, c, d) <= tolerance) return false;
    }
  }
  return true;
}

/** Even-odd point-in-ring test. Points exactly on the boundary may go either way. */
export function pointInRing(p: Pt, ring: Ring): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = ring[i] as Pt;
    const b = ring[j] as Pt;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

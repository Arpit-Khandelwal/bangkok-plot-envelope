import { describe, expect, it } from 'vitest';
import type { Pt } from '../types';
import {
  centroid,
  dedupeIndices,
  distanceToSegment,
  isSimple,
  perimeter,
  pointInRing,
  removeDuplicatePoints,
  segmentDistance,
  signedArea,
  signedDistanceToLine,
} from './ring';

const P = (x: number, y: number): Pt => ({ x, y });
const square = [P(0, 0), P(10, 0), P(10, 10), P(0, 10)];
const L = [P(0, 0), P(40, 0), P(40, 10), P(10, 10), P(10, 30), P(0, 30)];

describe('signedArea / perimeter / centroid', () => {
  it('is positive for CCW and negative for CW', () => {
    expect(signedArea(square)).toBe(100);
    expect(signedArea([...square].reverse())).toBe(-100);
    expect(signedArea(L)).toBe(600);
  });

  it('stays exact far from the origin', () => {
    const far = square.map((p) => P(p.x + 1e6, p.y + 1e6));
    expect(signedArea(far)).toBe(100);
  });

  it('is zero for degenerate rings', () => {
    expect(signedArea([P(0, 0), P(1, 1)])).toBe(0);
    expect(signedArea([P(0, 0), P(1, 1), P(2, 2)])).toBe(0);
  });

  it('computes perimeter and centroid', () => {
    expect(perimeter(square)).toBe(40);
    expect(perimeter(L)).toBe(140);
    expect(centroid(square)).toEqual({ x: 5, y: 5 });
    const c = centroid(L);
    // 40x10 (centre 20,5) + 10x20 (centre 5,20): (400*20 + 200*5)/600, (400*5 + 200*20)/600
    expect(c.x).toBeCloseTo(15, 12);
    expect(c.y).toBeCloseTo(10, 12);
  });
});

describe('removeDuplicatePoints', () => {
  it('drops consecutive and wrap-around duplicates', () => {
    const ring = [P(0, 0), P(0, 0), P(10, 0), P(10, 0.001), P(10, 10), P(0, 10), P(0, 0)];
    expect(removeDuplicatePoints(ring)).toEqual([P(0, 0), P(10, 0), P(10, 0.001), P(10, 10), P(0, 10)]);
    expect(removeDuplicatePoints(ring, 0.01)).toEqual([P(0, 0), P(10, 0), P(10, 10), P(0, 10)]);
    expect(dedupeIndices(ring, 0.01)).toEqual([0, 2, 4, 5]);
  });

  it('does not mutate its input', () => {
    const ring = [P(0, 0), P(0, 0), P(1, 0), P(1, 1)];
    const copy = JSON.stringify(ring);
    removeDuplicatePoints(ring);
    expect(JSON.stringify(ring)).toBe(copy);
  });

  it('collapses an all-identical ring to one point', () => {
    expect(removeDuplicatePoints([P(1, 1), P(1, 1), P(1, 1)])).toEqual([P(1, 1)]);
  });
});

describe('distances', () => {
  it('measures distance to a segment, including beyond its ends', () => {
    expect(distanceToSegment(P(5, 3), P(0, 0), P(10, 0))).toBe(3);
    expect(distanceToSegment(P(13, 4), P(0, 0), P(10, 0))).toBe(5);
    expect(distanceToSegment(P(-3, -4), P(0, 0), P(10, 0))).toBe(5);
    expect(distanceToSegment(P(3, 4), P(0, 0), P(0, 0))).toBe(5);
  });

  it('measures signed distance to a line, positive on the left', () => {
    expect(signedDistanceToLine(P(5, 3), P(0, 0), P(10, 0))).toBe(3);
    expect(signedDistanceToLine(P(50, -2), P(0, 0), P(10, 0))).toBe(-2);
    // Inward for every edge of a CCW ring
    for (let i = 0; i < 4; i++) {
      expect(signedDistanceToLine(P(5, 5), square[i] as Pt, square[(i + 1) % 4] as Pt)).toBeCloseTo(5, 12);
    }
  });

  it('measures segment-to-segment distance', () => {
    expect(segmentDistance(P(0, 0), P(10, 0), P(5, -5), P(5, 5))).toBe(0);
    expect(segmentDistance(P(0, 0), P(10, 0), P(0, 2), P(10, 2))).toBe(2);
    expect(segmentDistance(P(0, 0), P(10, 0), P(10, 0), P(20, 5))).toBe(0);
  });
});

describe('isSimple', () => {
  it('accepts convex, concave and collinear-cornered rings', () => {
    expect(isSimple(square)).toBe(true);
    expect(isSimple(L)).toBe(true);
    expect(isSimple([P(0, 0), P(5, 0), P(10, 0), P(10, 10), P(0, 10)])).toBe(true);
  });

  it('rejects a bow-tie', () => {
    expect(isSimple([P(0, 0), P(10, 10), P(10, 0), P(0, 10)])).toBe(false);
  });

  it('rejects non-adjacent edges that only touch', () => {
    // Vertex (5, 0) of the notch touches the bottom edge.
    const touching = [P(0, 0), P(10, 0), P(10, 10), P(5, 0.0), P(0, 10)];
    expect(isSimple(touching)).toBe(false);
    const nearlyTouching = [P(0, 0), P(10, 0), P(10, 10), P(5, 0.0005), P(0, 10)];
    expect(isSimple(nearlyTouching)).toBe(true);
    expect(isSimple(nearlyTouching, 0.001)).toBe(false);
  });

  it('rejects spikes that fold back on themselves', () => {
    expect(isSimple([P(0, 0), P(10, 0), P(10, 10), P(10, 5), P(0, 10)])).toBe(false);
    expect(isSimple([P(0, 0), P(10, 0), P(20, 0), P(5, 0), P(0, 10)])).toBe(false);
  });

  it('rejects rings with repeated points or too few points', () => {
    expect(isSimple([P(0, 0), P(1, 0)])).toBe(false);
    expect(isSimple([P(0, 0), P(1, 0), P(1, 0), P(0, 1)])).toBe(false);
  });
});

describe('pointInRing', () => {
  it('handles concave rings', () => {
    expect(pointInRing(P(5, 5), L)).toBe(true);
    expect(pointInRing(P(5, 25), L)).toBe(true);
    expect(pointInRing(P(25, 20), L)).toBe(false);
    expect(pointInRing(P(-1, 5), L)).toBe(false);
  });
});

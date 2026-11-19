import { describe, expect, it } from 'vitest';
import type { Polygon, Pt, Region } from '../types';
import { arcSegments, capsule } from './capsule';
import {
  clipHalfPlane,
  difference,
  insetUniform,
  intersection,
  largestPiece,
  minDistanceToSegment,
  pointInRegion,
  regionArea,
  shrinkUniform,
  union,
  unionAll,
} from './region';
import { signedArea } from './ring';

const P = (x: number, y: number): Pt => ({ x, y });
const poly = (outer: Pt[], holes: Pt[][] = []): Polygon => ({ outer, holes });
const rect = (x0: number, y0: number, x1: number, y1: number): Polygon =>
  poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]);
/** L-shape: 4 x 1 arm along x, 1 x 3 arm along y, area 6. */
const L: Region = [poly([P(0, 0), P(4, 0), P(4, 1), P(1, 1), P(1, 3), P(0, 3)])];
const SQ: Region = [rect(0.5, 0.5, 2, 2)];
const DONUT: Region = [poly([P(0, 0), P(3, 0), P(3, 3), P(0, 3)], [[P(1, 1), P(1, 2), P(2, 2), P(2, 1)]])];

describe('booleans on a concave polygon', () => {
  it('matches hand-computed areas', () => {
    expect(regionArea(L)).toBeCloseTo(6, 9);
    expect(regionArea(intersection(L, SQ))).toBeCloseTo(1.25, 9);
    expect(regionArea(union(L, SQ))).toBeCloseTo(7, 9);
    expect(regionArea(difference(L, SQ))).toBeCloseTo(4.75, 9);
    expect(regionArea(difference(SQ, L))).toBeCloseTo(1, 9);
  });

  it('returns CCW outers and CW holes', () => {
    const r = difference([rect(0, 0, 10, 10)], [rect(4, 4, 6, 6)]);
    expect(r).toHaveLength(1);
    const p = r[0] as Polygon;
    expect(signedArea(p.outer)).toBeGreaterThan(0);
    expect(p.holes).toHaveLength(1);
    expect(signedArea(p.holes[0] as Pt[])).toBeLessThan(0);
    expect(regionArea(r)).toBeCloseTo(96, 9);
  });

  it('accepts input of either orientation', () => {
    const cw: Region = [poly([...(L[0] as Polygon).outer].reverse())];
    expect(regionArea(union(cw))).toBeCloseTo(6, 9);
    expect(regionArea(difference(DONUT, cw))).toBeCloseTo(regionArea(difference(DONUT, L)), 9);
  });

  it('handles holes and islands in holes', () => {
    expect(regionArea(DONUT)).toBeCloseTo(8, 9);
    const island = union(DONUT, [rect(1.25, 1.25, 1.75, 1.75)]);
    expect(island).toHaveLength(2);
    expect(regionArea(island)).toBeCloseTo(8.25, 9);
  });

  it('dissolves overlaps and drops slivers under 0.01 m2', () => {
    expect(regionArea(unionAll([[rect(0, 0, 2, 2)], [rect(1, 1, 3, 3)]]))).toBeCloseTo(7, 9);
    expect(union([rect(0, 0, 0.05, 0.05)])).toEqual([]);
    const sliverCut = difference([rect(0, 0, 10, 10)], [rect(0.001, -1, 11, 11)]);
    expect(sliverCut).toEqual([]);
  });

  it('snaps to the millimetre grid', () => {
    const r = union([rect(0.0004, 0, 1.0006, 1)]);
    const xs = (r[0] as Polygon).outer.map((p) => p.x).sort((a, b) => a - b);
    expect(xs[0]).toBe(0);
    expect(xs[xs.length - 1]).toBe(1.001);
  });

  it('does not mutate inputs', () => {
    const before = JSON.stringify(L);
    union(L, SQ);
    difference(L, SQ);
    clipHalfPlane(L, 1, 0, -2);
    insetUniform(L, 0.2);
    expect(JSON.stringify(L)).toBe(before);
  });
});

describe('capsule', () => {
  it('contains the true stadium and overshoots by at most the tolerance', () => {
    const a = P(0, 0);
    const b = P(10, 0);
    const d = 3;
    const caps = capsule(a, b, d, 0.02);
    expect(signedArea(caps)).toBeGreaterThan(0);
    const trueArea = 2 * d * 10 + Math.PI * d * d;
    const area = signedArea(caps);
    expect(area).toBeGreaterThanOrEqual(trueArea);
    expect(area - trueArea).toBeLessThan(2 * Math.PI * d * 0.02);
    for (const p of caps) {
      const dist = p.x < 0 ? Math.hypot(p.x, p.y) : p.x > 10 ? Math.hypot(p.x - 10, p.y) : Math.abs(p.y);
      expect(dist).toBeGreaterThanOrEqual(d - 1e-9);
      expect(dist).toBeLessThanOrEqual(d + 0.02 + 1e-9);
    }
  });

  it('is empty for zero or invalid radius', () => {
    expect(capsule(P(0, 0), P(1, 0), 0)).toEqual([]);
    expect(capsule(P(0, 0), P(1, 0), -1)).toEqual([]);
    expect(capsule(P(0, 0), P(1, 0), Number.NaN)).toEqual([]);
    expect(arcSegments(6, 0.02)).toBeGreaterThan(10);
  });
});

describe('shrinkUniform', () => {
  it('shrinks a rectangle by the distance on every side', () => {
    expect(regionArea(shrinkUniform([rect(0, 0, 10, 6)], 1))).toBeCloseTo(8 * 4, 6);
  });

  it('stays inside a concave region and leaves nothing when shrunk too far', () => {
    const r = shrinkUniform(L, 0.2);
    expect(regionArea(difference(r, L))).toBe(0);
    // Mitred: 3.6 x 0.6 + 0.6 x 2.0, with a square (not round) reflex corner.
    expect(regionArea(r)).toBeCloseTo(3.36, 6);
    expect(shrinkUniform(L, 5)).toEqual([]);
  });
});

describe('insetUniform', () => {
  it('shrinks a concave L with round reflex corners', () => {
    // Arms 4x1 and 1x3 inset by 0.2: 3.6x0.6 + 0.6x2.0 plus the corner fillet 0.04 - pi*0.04/4.
    const expected = 2.16 + 1.2 + (0.04 - (Math.PI * 0.04) / 4);
    const r = insetUniform(L, 0.2);
    expect(r).toHaveLength(1);
    expect(Math.abs(regionArea(r) - expected)).toBeLessThan(0.003);
    expect(regionArea(r)).toBeLessThanOrEqual(expected + 1e-6);
  });

  it('can split into pieces or leave nothing', () => {
    const dumbbell: Region = [
      poly([P(0, 0), P(4, 0), P(4, 1.5), P(6, 1.5), P(6, 0), P(10, 0), P(10, 4), P(6, 4), P(6, 2.5), P(4, 2.5), P(4, 4), P(0, 4)]),
    ];
    expect(insetUniform(dumbbell, 0.6)).toHaveLength(2);
    expect(insetUniform(dumbbell, 2.5)).toEqual([]);
    expect(regionArea(insetUniform(dumbbell, 0))).toBeCloseTo(regionArea(dumbbell), 9);
  });

  it('grows holes', () => {
    const r = insetUniform(DONUT, 0.25);
    expect(r).toHaveLength(1);
    // Outer 2.5x2.5 minus hole grown to 1.5x1.5 with round corners.
    const expected = 6.25 - (1.5 * 1.5 - (4 - Math.PI) * 0.0625);
    // Circumscribed arcs make the grown hole slightly larger: conservative by < arc length x tol.
    expect(regionArea(r)).toBeLessThanOrEqual(expected + 1e-6);
    expect(expected - regionArea(r)).toBeLessThan(2 * Math.PI * 0.25 * 0.02 + 0.001);
  });
});

describe('clipHalfPlane', () => {
  it('clips a concave ring exactly', () => {
    // Keep x >= 2: only the horizontal arm, 2 x 1.
    expect(regionArea(clipHalfPlane(L, 1, 0, -2))).toBeCloseTo(2, 9);
    // Keep x <= 0.5: the vertical strip 0.5 x 3.
    expect(regionArea(clipHalfPlane(L, -1, 0, 0.5))).toBeCloseTo(1.5, 9);
    // Keep y >= 0.5 cuts the L into a single L-shaped piece: 4*0.5 + 1*2.
    expect(regionArea(clipHalfPlane(L, 0, 1, -0.5))).toBeCloseTo(4, 9);
  });

  it('splits a U into two pieces', () => {
    const U: Region = [poly([P(0, 0), P(5, 0), P(5, 5), P(4, 5), P(4, 1), P(1, 1), P(1, 5), P(0, 5)])];
    const r = clipHalfPlane(U, 0, 1, -2);
    expect(r).toHaveLength(2);
    expect(regionArea(r)).toBeCloseTo(6, 9);
  });

  it('cuts through holes', () => {
    expect(regionArea(clipHalfPlane(DONUT, 1, 0, -1.5))).toBeCloseTo(4.5 - 0.5, 9);
  });

  it('handles diagonal lines, all-in, all-out and degenerate normals', () => {
    const sq = [rect(0, 0, 2, 2)];
    expect(regionArea(clipHalfPlane(sq, 1, 1, -2))).toBeCloseTo(2, 9);
    expect(regionArea(clipHalfPlane(sq, 1, 0, 5))).toBeCloseTo(4, 9);
    expect(clipHalfPlane(sq, 1, 0, -5)).toEqual([]);
    expect(regionArea(clipHalfPlane(sq, 0, 0, 1))).toBeCloseTo(4, 9);
    expect(clipHalfPlane(sq, 0, 0, -1)).toEqual([]);
    expect(clipHalfPlane([], 1, 0, 0)).toEqual([]);
  });
});

describe('queries', () => {
  it('finds the largest piece', () => {
    const r: Region = [rect(0, 0, 1, 1), rect(5, 5, 8, 8), rect(10, 0, 12, 1)];
    expect(regionArea(largestPiece(r))).toBe(9);
    expect(largestPiece([])).toEqual([]);
  });

  it('tests points against holes', () => {
    expect(pointInRegion(P(0.5, 0.5), DONUT)).toBe(true);
    expect(pointInRegion(P(1.5, 1.5), DONUT)).toBe(false);
    expect(pointInRegion(P(4, 4), DONUT)).toBe(false);
  });

  it('measures distance from a region to a segment', () => {
    expect(minDistanceToSegment(DONUT, P(5, 0), P(5, 3))).toBeCloseTo(2, 12);
    expect(minDistanceToSegment(DONUT, P(-1, 1.5), P(4, 1.5))).toBe(0);
    expect(minDistanceToSegment(DONUT, P(1.5, 1.5), P(1.6, 1.6))).toBeCloseTo(0.4, 12);
    expect(minDistanceToSegment([], P(0, 0), P(1, 1))).toBe(Infinity);
  });
});

import { describe, expect, it } from 'vitest';
import type { HeightPlane } from '../types';
import { heightLimitAt, planeCoefficients, sliceAtHeight } from './height';
import { regionArea } from './region';
import { applySetbacks } from './setbacks';
import { P, rectRing, setbacksOf, siteFromRing } from './test-helpers';

/** 40 x 30 rectangle; edge 0 is the south side (y = 0), edge 1 the east side (x = 40). */
const site = siteFromRing(rectRing(40, 30));
const south: HeightPlane = { edgeIndex: 0, rowWidthM: 10, slope: 2, ruleId: 'h' };
const east: HeightPlane = { edgeIndex: 1, rowWidthM: 4, slope: 2, ruleId: 'h' };

describe('heightLimitAt', () => {
  it('is Infinity without planes or cap, and the cap alone otherwise', () => {
    expect(heightLimitAt(site, [], null, P(5, 5))).toBe(Infinity);
    expect(heightLimitAt(site, [], 23, P(5, 5))).toBe(23);
  });

  it('is 2 x (6 + 10) = 32 m at a 6 m setback line and rises 2 m per metre', () => {
    expect(heightLimitAt(site, [south], null, P(20, 6))).toBeCloseTo(32, 12);
    expect(heightLimitAt(site, [south], null, P(20, 7))).toBeCloseTo(34, 12);
    expect(heightLimitAt(site, [south], null, P(3, 10))).toBeCloseTo(40, 12);
    expect(heightLimitAt(site, [south], 35, P(20, 7))).toBe(34);
    expect(heightLimitAt(site, [south], 33, P(20, 7))).toBe(33);
  });

  it('takes the lower plane at each point with two road edges', () => {
    // Near the south road: south governs.
    expect(heightLimitAt(site, [south, east], null, P(20, 2))).toBeCloseTo(2 * (2 + 10), 12);
    // Near the east road: east governs (distance 1 from x = 40).
    expect(heightLimitAt(site, [south, east], null, P(39, 20))).toBeCloseTo(2 * (1 + 4), 12);
    // Equal where d_s + 10 = d_e + 4.
    expect(heightLimitAt(site, [south, east], null, P(30, 4))).toBeCloseTo(28, 12);
  });

  it('clamps the distance at zero beyond the edge line', () => {
    expect(heightLimitAt(site, [south], null, P(20, -5))).toBeCloseTo(20, 12);
  });

  it('flags invalid planes with NaN', () => {
    expect(heightLimitAt(site, [{ ...south, edgeIndex: 7 }], null, P(1, 1))).toBeNaN();
    expect(heightLimitAt(site, [{ ...south, slope: -1 }], null, P(1, 1))).toBeNaN();
  });
});

describe('planeCoefficients', () => {
  it('matches heightLimitAt on the inward side for a slanted edge', () => {
    const tri = siteFromRing([P(0, 0), P(30, 10), P(5, 25)]);
    for (let e = 0; e < 3; e++) {
      const plane: HeightPlane = { edgeIndex: e, rowWidthM: 7, slope: 1.5, ruleId: 'h' };
      const f = planeCoefficients(tri, plane);
      for (const p of [P(10, 10), P(12, 8), P(8, 15)]) {
        expect(f.a * p.x + f.b * p.y + f.c).toBeCloseTo(heightLimitAt(tri, [plane], null, p), 9);
      }
    }
  });
});

describe('sliceAtHeight', () => {
  it('keeps the part of the footprint where the limit reaches z', () => {
    const fp = applySetbacks(site, setbacksOf([6, 2, 2, 2]));
    // Footprint is x 2..38, y 6..28. Limit 2 (y + 10) >= 40 <=> y >= 10.
    expect(regionArea(sliceAtHeight(site, fp, [south], 40))).toBeCloseTo(36 * 18, 6);
    // Below the setback line height the whole footprint remains.
    expect(regionArea(sliceAtHeight(site, fp, [south], 30))).toBeCloseTo(36 * 22, 6);
    // Above the top of the footprint nothing remains: 2 (28 + 10) = 76.
    expect(sliceAtHeight(site, fp, [south], 77)).toEqual([]);
  });

  it('applies every plane', () => {
    const fp = [{ outer: rectRing(40, 30), holes: [] }];
    // y >= 10 from the south (2(y+10) >= 40) and x <= 24 from the east (2(40-x+4) >= 40).
    expect(regionArea(sliceAtHeight(site, fp, [south, east], 40))).toBeCloseTo(24 * 20, 6);
  });

  it('skips a plane whose clamp floor already reaches z, and handles bad planes', () => {
    const fp = [{ outer: rectRing(40, 30), holes: [] }];
    expect(regionArea(sliceAtHeight(site, fp, [south], 20))).toBeCloseTo(1200, 6);
    expect(sliceAtHeight(site, fp, [{ ...south, slope: 0 }], 1)).toEqual([]);
    expect(regionArea(sliceAtHeight(site, fp, [{ ...south, slope: 0 }], 0))).toBeCloseTo(1200, 6);
    expect(sliceAtHeight(site, fp, [{ ...south, edgeIndex: -1 }], 1)).toEqual([]);
  });
});

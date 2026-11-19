/** Outward offset and morphological opening: removing the parts of a region narrower than a width. */
import { describe, expect, it } from 'vitest';
import type { Pt, Region } from '../types';
import { difference, growUniform, openRegion, regionArea, regionWidth } from './region';
import { symDiffArea } from './test-helpers';

const P = (x: number, y: number): Pt => ({ x, y });
const rect = (x0: number, y0: number, x1: number, y1: number): Region => [
  { outer: [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], holes: [] },
];
/** A 20 x 20 square with a 3 m wide, 15 m long arm sticking out of its right side. */
const SQUARE_WITH_ARM: Region = [
  {
    outer: [P(0, 0), P(20, 0), P(20, 8), P(35, 8), P(35, 11), P(20, 11), P(20, 20), P(0, 20)],
    holes: [],
  },
];
const FLAG: Region = [
  { outer: [P(0, 0), P(9, 0), P(9, 20), P(30, 20), P(30, 45), P(-10, 45), P(-10, 20), P(0, 20)], holes: [] },
];

describe('growUniform (outward offset, mitred)', () => {
  it('grows a 10 x 10 square by 1 m to a 12 x 12 square', () => {
    expect(regionArea(growUniform(rect(0, 0, 10, 10), 1))).toBeCloseTo(144, 6);
  });
});

describe('openRegion', () => {
  it('removes a 3 m wide arm and leaves the 20 x 20 square', () => {
    const opened = openRegion(SQUARE_WITH_ARM, 8);
    expect(symDiffArea(opened, rect(0, 0, 20, 20))).toBeLessThan(0.05);
  });

  it('never grows the region', () => {
    for (const region of [SQUARE_WITH_ARM, FLAG, rect(0, 0, 9, 30)]) {
      for (const width of [3, 6, 8, 12]) {
        expect(regionArea(difference(openRegion(region, width), region))).toBeLessThan(1e-6);
      }
    }
  });

  it('leaves a plain rectangle unchanged within 1 cm', () => {
    const r = rect(2, 3, 32, 18);
    const opened = openRegion(r, 8);
    // A 1 cm band around the 90 m perimeter is 0.9 m2.
    expect(symDiffArea(opened, r)).toBeLessThan(0.9);
    expect(regionArea(opened)).toBeCloseTo(450, 1);
  });

  it('keeps a part exactly the minimum width', () => {
    expect(regionArea(openRegion(rect(0, 0, 8, 30), 8))).toBeCloseTo(240, 0);
  });

  it('removes the access strip of a flag shape', () => {
    const opened = openRegion(FLAG, 12);
    expect(regionArea(opened)).toBeCloseTo(40 * 25, 0);
  });

  it('empties a region narrower than the width everywhere', () => {
    expect(openRegion(rect(0, 0, 6, 60), 8)).toEqual([]);
  });

  it('is idempotent within half a square metre', () => {
    for (const region of [SQUARE_WITH_ARM, FLAG]) {
      const once = openRegion(region, 8);
      expect(regionArea(once) - regionArea(openRegion(once, 8))).toBeLessThan(0.5);
    }
  });

  it('returns the region snapped for a width of zero or less', () => {
    expect(regionArea(openRegion(SQUARE_WITH_ARM, 0))).toBeCloseTo(regionArea(SQUARE_WITH_ARM), 6);
  });
});

describe('regionWidth', () => {
  it('is the width of a strip', () => {
    expect(regionWidth(rect(0, 0, 6, 60))).toBeCloseTo(6, 1);
  });

  it('is the width of the widest part', () => {
    expect(regionWidth(SQUARE_WITH_ARM)).toBeCloseTo(20, 0);
  });

  it('is 0 for an empty region', () => {
    expect(regionWidth([])).toBe(0);
  });
});

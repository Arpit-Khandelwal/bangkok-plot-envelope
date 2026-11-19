import { describe, expect, it } from 'vitest';
import { outwardOffsets, type ScreenPoint } from './markerOffset';

// Screen coordinates: y grows downwards.
const SQUARE: readonly ScreenPoint[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

function rounded(offsets: readonly (readonly [number, number])[]): number[][] {
  return offsets.map(([x, y]) => [Math.round(x) + 0, Math.round(y) + 0]);
}

describe('outwardOffsets', () => {
  it('pushes every chip of a square away from the interior', () => {
    expect(rounded(outwardOffsets(SQUARE, 18))).toEqual([
      [0, -18],
      [18, 0],
      [0, 18],
      [-18, 0],
    ]);
  });

  it('gives the same outward directions for the opposite winding', () => {
    const reversed = [...SQUARE].reverse();
    // Edges of the reversed ring: bottom, right, top, left.
    expect(rounded(outwardOffsets(reversed, 18))).toEqual([
      [0, 18],
      [18, 0],
      [0, -18],
      [-18, 0],
    ]);
  });

  it('is correct on a concave plot where the centroid test would fail', () => {
    // An L shape. The inner corner edges face towards the centroid but are still outward.
    const ell: ScreenPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 30 },
      { x: 30, y: 30 },
      { x: 30, y: 100 },
      { x: 0, y: 100 },
    ];
    const offsets = rounded(outwardOffsets(ell, 10));
    // Edge 2 runs (100,30) -> (30,30): the interior is above it, so outward is down.
    expect(offsets[2]).toEqual([0, 10]);
    // Edge 3 runs (30,30) -> (30,100): the interior is to the left, so outward is right.
    expect(offsets[3]).toEqual([10, 0]);
  });

  it('handles a slanted edge with unit-length scaling', () => {
    const triangle: ScreenPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const [first] = outwardOffsets(triangle, 18);
    expect(first).toBeDefined();
    const [x, y] = first ?? [0, 0];
    expect(Math.hypot(x, y)).toBeCloseTo(18);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeLessThan(0);
  });

  it('pushes an edge seen end-on away from the centre', () => {
    const ring: ScreenPoint[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const [degenerate] = outwardOffsets(ring, 10);
    const [x, y] = degenerate ?? [0, 0];
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
  });

  it('returns no offset for fewer than three points', () => {
    expect(outwardOffsets([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});

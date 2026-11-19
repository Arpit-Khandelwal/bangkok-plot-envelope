import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LngLat } from '../core/types';
import { isInsideStudyArea, plotCentroid, STUDY_BBOX, type Bbox } from './studyArea';

const BOX: Bbox = [100, 13, 101, 14];

function square(lng: number, lat: number, size = 0.001): LngLat[] {
  return [
    [lng, lat],
    [lng + size, lat],
    [lng + size, lat + size],
    [lng, lat + size],
  ];
}

describe('isInsideStudyArea', () => {
  it('is true for a plot whose centroid is inside the box', () => {
    expect(isInsideStudyArea(square(100.5, 13.5), BOX)).toBe(true);
  });

  it('is false for a plot whose centroid is outside the box', () => {
    expect(isInsideStudyArea(square(101.2, 13.5), BOX)).toBe(false);
    expect(isInsideStudyArea(square(100.5, 12.5), BOX)).toBe(false);
  });

  it('goes by the centroid when the plot straddles the edge', () => {
    // Centroid at lng 100.9996: inside, though one side pokes out.
    expect(isInsideStudyArea(square(100.9991, 13.5), BOX)).toBe(true);
    // Centroid at lng 101.0004: outside, though one side is in.
    expect(isInsideStudyArea(square(100.9999, 13.5), BOX)).toBe(false);
  });

  it('is false for an empty plot', () => {
    expect(isInsideStudyArea([], BOX)).toBe(false);
  });

  it('uses the baked study box by default', () => {
    expect(isInsideStudyArea(square(100.609, 13.6893))).toBe(true);
    expect(isInsideStudyArea(square(100.5018, 13.7563))).toBe(false);
  });
});

describe('plotCentroid', () => {
  it('is the area centroid of an L-shaped plot, not the corner average', () => {
    const plot: LngLat[] = [
      [0, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 3],
      [0, 3],
    ];
    const [x, y] = plotCentroid(plot) ?? [NaN, NaN];
    // Area 4: a 2x1 bar (centre 1, 0.5) and a 1x2 bar (centre 0.5, 2).
    expect(x).toBeCloseTo(0.75, 9);
    expect(y).toBeCloseTo(1.25, 9);
  });

  it('falls back to the corner average for a degenerate plot', () => {
    expect(plotCentroid([[1, 1], [2, 2], [3, 3]])).toEqual([2, 2]);
  });
});

describe('STUDY_BBOX', () => {
  it('matches study.bbox in public/data/meta.json', () => {
    const meta = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'meta.json'), 'utf8')) as {
      readonly study: { readonly bbox: readonly number[] };
    };
    expect([...STUDY_BBOX]).toEqual(meta.study.bbox);
  });
});

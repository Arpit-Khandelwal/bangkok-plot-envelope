import type { Feature, Geometry, Position } from 'geojson';
import { describe, expect, it } from 'vitest';
import { makeFrame, toLngLat } from '../core/geom/frame';
import type { LngLat } from '../core/types';
import { buildingsOnPlot, indexFootprints } from './buildingsOnPlot';

const FRAME = makeFrame([[100.609, 13.6893]]);

function at(x: number, y: number): Position {
  const [lng, lat] = toLngLat(FRAME, { x, y });
  return [lng, lat];
}

/** Closed GeoJSON ring of an axis-aligned rectangle given in local metres. */
function box(x0: number, y0: number, x1: number, y1: number): Position[] {
  return [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1), at(x0, y0)];
}

function building(i: number, geometry: Geometry): Feature<Geometry, { readonly i: number }> {
  return { type: 'Feature', geometry, properties: { i } };
}

function polygon(...rings: Position[][]): Geometry {
  return { type: 'Polygon', coordinates: rings };
}

// The plot: a 40 x 40 m square from (0, 0) to (40, 40).
const PLOT: LngLat[] = box(0, 0, 40, 40)
  .slice(0, 4)
  .map((position): LngLat => [position[0] ?? 0, position[1] ?? 0]);

function hiddenIds(features: Feature<Geometry, { readonly i: number }>[], plot: readonly LngLat[] = PLOT): number[] {
  return buildingsOnPlot(indexFootprints(features), plot).sort((a, b) => a - b);
}

describe('buildingsOnPlot', () => {
  it('hides a building whose centre is on the plot', () => {
    expect(hiddenIds([building(1, polygon(box(10, 10, 20, 20)))])).toEqual([1]);
  });

  it('keeps a building well clear of the plot', () => {
    expect(hiddenIds([building(1, polygon(box(100, 100, 120, 120)))])).toEqual([]);
  });

  it('keeps a building whose bounding box overlaps but whose footprint does not', () => {
    // An L wrapping round the plot's north-east corner without touching it.
    const ell = [at(45, -10), at(60, -10), at(60, 60), at(-10, 60), at(-10, 45), at(45, 45), at(45, -10)];
    expect(hiddenIds([building(1, polygon(ell))])).toEqual([]);
  });

  it('hides an L-shaped building whose centre is on the plot even with a small overlap', () => {
    // Same L, pulled in to overlap the plot's north-east strip by about 6% of its own area.
    const ell = [at(38, -10), at(60, -10), at(60, 60), at(-10, 60), at(-10, 38), at(38, 38), at(38, -10)];
    expect(hiddenIds([building(1, polygon(ell))])).toEqual([1]);
  });

  it('hides a large building that overlaps the plot by more than a fifth of its own area', () => {
    // 60 x 20 m building, centre at (55, 30) off the plot; 15 x 20 m of it (25%) is on the plot.
    expect(hiddenIds([building(1, polygon(box(25, 20, 85, 40)))])).toEqual([1]);
  });

  it('keeps a building that only clips the plot edge', () => {
    // 60 x 20 m building with 6 x 20 m (10%) on the plot.
    expect(hiddenIds([building(1, polygon(box(34, 20, 94, 40)))])).toEqual([]);
  });

  it('hides a building that contains the plot centroid', () => {
    // A huge podium covering the plot: its centre is far away but the plot centroid is inside it.
    expect(hiddenIds([building(1, polygon(box(-20, -20, 400, 60)))])).toEqual([1]);
  });

  it('does not count a courtyard hole as covering the plot centroid', () => {
    // A ring building around the plot: the plot sits in the courtyard.
    const ringBuilding = polygon(box(-30, -30, 70, 70), box(-5, -5, 45, 45).reverse());
    expect(hiddenIds([building(1, ringBuilding)])).toEqual([]);
  });

  it('handles every part of a multipolygon', () => {
    const geometry: Geometry = {
      type: 'MultiPolygon',
      coordinates: [[box(200, 200, 210, 210)], [box(5, 5, 15, 15)]],
    };
    expect(hiddenIds([building(7, geometry)])).toEqual([7]);
  });

  it('works for a clockwise plot and returns each building once', () => {
    const features = [building(1, polygon(box(10, 10, 20, 20))), building(2, polygon(box(-20, -20, 400, 60)))];
    expect(hiddenIds(features, [...PLOT].reverse())).toEqual([1, 2]);
  });

  it('returns nothing for a plot with fewer than three corners', () => {
    expect(hiddenIds([building(1, polygon(box(10, 10, 20, 20)))], PLOT.slice(0, 2))).toEqual([]);
  });

  it('skips geometry that is not a polygon', () => {
    const point: Geometry = { type: 'Point', coordinates: at(10, 10) };
    expect(indexFootprints([building(1, point)])).toEqual([]);
  });
});

import type { Feature, Geometry, Position } from 'geojson';
import { describe, expect, it } from 'vitest';
import { makeFrame, toLngLat } from '../core/geom/frame';
import type { EdgeSpec, LngLat } from '../core/types';
import { indexFootprints, type FootprintProperties } from './buildingsOnPlot';
import { chooseView } from './viewChoice';

const FRAME = makeFrame([[100.609, 13.6893]]);

function at(x: number, y: number): Position {
  const [lng, lat] = toLngLat(FRAME, { x, y });
  return [lng, lat];
}

function tower(i: number, x0: number, y0: number, x1: number, y1: number, h: number): Feature<Geometry, FootprintProperties> {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1), at(x0, y0)]] },
    properties: { i, h },
  };
}

// 40 x 40 m plot, counter-clockwise from the south-west corner; edge 0 is the south edge.
const PLOT: LngLat[] = [at(0, 0), at(40, 0), at(40, 40), at(0, 40)].map((p): LngLat => [p[0] ?? 0, p[1] ?? 0]);
const NEIGHBOUR: EdgeSpec = { kind: 'neighbour' };
const SOUTH_ROAD: EdgeSpec[] = [{ kind: 'road', roadId: 'soi', rowWidthM: 10 }, NEIGHBOUR, NEIGHBOUR, NEIGHBOUR];

function view(features: Feature<Geometry, FootprintProperties>[], hiddenIds: number[] = [], edges = SOUTH_ROAD) {
  return chooseView({
    plot: PLOT,
    edges,
    buildings: indexFootprints(features),
    hiddenIds: new Set(hiddenIds),
    currentBearing: 30,
  });
}

describe('chooseView', () => {
  it('keeps the road-side bearing and default pitch on an open site', () => {
    expect(view([])).toEqual({ bearing: expect.closeTo(0, 2), pitch: 58, occlusion: 0 });
  });

  it('keeps the road-side bearing when only low buildings stand across the road', () => {
    expect(view([tower(1, -20, -40, 60, -15, 6)]).bearing).toBeCloseTo(0, 2);
  });

  it('turns away from a tower standing on the road side', () => {
    // A 90 m tower across the road to the south: the camera, south of the plot, would look through it.
    const choice = view([tower(1, -10, -55, 50, -15, 90)]);
    expect(choice.bearing).not.toBeCloseTo(0, 2);
    expect(choice.occlusion).toBeLessThan(0.1);
    expect(view([tower(1, -10, -55, 50, -15, 90)], [1]).bearing).toBeCloseTo(0, 2);
  });

  it('prefers the bearing nearest the road side among equally clear ones', () => {
    const choice = view([tower(1, -10, -55, 50, -15, 90)]);
    // Clear views exist on both flanks; the nearest to 0 is chosen, so not looking from the north.
    expect(Math.abs(choice.bearing)).toBeLessThanOrEqual(90);
  });

  it('ignores buildings hidden because they stand on the plot', () => {
    expect(view([tower(9, 5, 5, 35, 35, 120)], [9])).toEqual({ bearing: expect.closeTo(0, 2), pitch: 58, occlusion: 0 });
  });

  it('looks down more steeply when buildings ring the plot', () => {
    // 35 m blocks 15 m from every edge: from any side at 58 degrees most of the plot is hidden.
    const ring = [
      tower(1, -45, -45, 85, -15, 35),
      tower(2, -45, 55, 85, 85, 35),
      tower(3, -45, -15, -15, 55, 35),
      tower(4, 55, -15, 85, 55, 35),
    ];
    const choice = view(ring);
    expect(choice.pitch).toBeLessThan(58);
  });

  it('settles on the least bad view when even steep views are blocked', () => {
    const walls = [
      tower(1, -45, -45, 85, -15, 300),
      tower(2, -45, 55, 85, 85, 300),
      tower(3, -45, -15, -15, 55, 300),
      tower(4, 55, -15, 85, 55, 300),
    ];
    const choice = view(walls);
    expect(choice.occlusion).toBeGreaterThan(0.34);
    expect([58, 45, 35]).toContain(choice.pitch);
  });

  it('uses the current bearing as the preference when no edge is a road', () => {
    expect(view([], [], [NEIGHBOUR, NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]).bearing).toBeCloseTo(30, 2);
  });

  it('ignores towers beyond the search range', () => {
    expect(view([tower(1, -10, -500, 50, -400, 300)]).bearing).toBeCloseTo(0, 2);
  });
});

import { describe, expect, it } from 'vitest';
import { edgeLetter as mapEdgeLetter } from '../map/edgeLabels';
import { edgeLetter, edgeListText } from './edgeNames';
import { metresPerDegree } from './geom/frame';
import { buildSite } from './geom/site';
import type { EdgeSpec, LngLat } from './types';

const ORIGIN: LngLat = [100.609, 13.689];
const SCALE = metresPerDegree(ORIGIN[1]);
const ll = (x: number, y: number): LngLat => [ORIGIN[0] + x / SCALE.lng, ORIGIN[1] + y / SCALE.lat];
const N: EdgeSpec = { kind: 'neighbour' };
const ROAD: EdgeSpec = { kind: 'road', roadId: 'r', rowWidthM: 12 };

describe('edgeLetter', () => {
  it('matches the map labels for the first 100 edges', () => {
    for (let i = 0; i <= 100; i++) expect(edgeLetter(i)).toBe(mapEdgeLetter(i));
  });

  it('names edges A to Z, then A2', () => {
    expect([edgeLetter(0), edgeLetter(25), edgeLetter(26), edgeLetter(27)]).toEqual(['A', 'Z', 'A2', 'B2']);
  });
});

describe('sourceIndex', () => {
  it('keeps the drawn edge index when a clockwise plot is reversed', () => {
    // Arrange: clockwise square, road on drawn edge 0 (west side, going north).
    const plot = [ll(0, 0), ll(0, 30), ll(30, 30), ll(30, 0)];
    const edges = [ROAD, N, N, N];

    // Act
    const result = buildSite(plot, edges);

    // Assert
    if (!result.ok) throw new Error('expected a valid site');
    const road = result.site.edges.find((e) => e.spec.kind === 'road');
    expect(road?.sourceIndex).toBe(0);
    expect(result.site.edges.map((e) => e.sourceIndex).sort()).toEqual([0, 1, 2, 3]);
    expect(edgeListText(result.site, [road?.index ?? -1])).toBe('edge A');
  });

  it('keeps the surviving drawn index when a duplicate corner is merged', () => {
    const plot = [ll(0, 0), ll(30, 0), ll(30, 0.001), ll(30, 30), ll(0, 30)];
    const result = buildSite(plot, [N, N, N, ROAD, N]);
    if (!result.ok) throw new Error('expected a valid site');
    expect(result.site.edges).toHaveLength(4);
    expect(result.site.edges.find((e) => e.spec.kind === 'road')?.sourceIndex).toBe(3);
  });
});

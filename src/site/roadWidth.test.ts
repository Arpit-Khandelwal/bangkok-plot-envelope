import { describe, expect, it } from 'vitest';
import type { LngLat } from '../core/types';
import { PRESETS } from '../state/presets';
import { suggestRoadWidth } from './roadWidth';
import type { RoadCollection, RoadProperties } from './roadWidth';

const M_LNG = 108173.3;
const M_LAT = 110636.8;
const ORIGIN: LngLat = [100.6, 13.7];
const at = (eastM: number, northM: number): LngLat => [ORIGIN[0] + eastM / M_LNG, ORIGIN[1] + northM / M_LAT];

/** 40 m square, corners counter-clockwise from the south-west. Edge 0 is the south edge. */
const PLOT: LngLat[] = [at(0, 0), at(40, 0), at(40, 40), at(0, 40)];

function road(points: LngLat[], properties: RoadProperties): RoadCollection['features'][number] {
  return { type: 'Feature', properties, geometry: { type: 'LineString', coordinates: points.map(([lng, lat]) => [lng, lat]) } };
}
const collection = (...features: RoadCollection['features']): RoadCollection => ({ type: 'FeatureCollection', features });

describe('suggestRoadWidth', () => {
  it('prefers a parallel road over a perpendicular one only in a near tie', () => {
    const roads = collection(
      road([at(-30, -10), at(70, -10)], { name: 'Parallel Road', widthEst: 14, widthSrc: 'est' }),
      road([at(20, -8), at(20, -30)], { name: 'Cross Soi', widthEst: 6, widthSrc: 'est' }),
    );
    const result = suggestRoadWidth(PLOT, 0, roads);
    expect(result?.roadName).toBe('Parallel Road');
    expect(result?.widthM).toBe(14);
    expect(result?.source).toBe('est');
    expect(result?.distanceM).toBeCloseTo(10, 0);
  });

  it('takes the nearer road when the parallel one is more than 3 m further', () => {
    // Before, any parallel road within 40 m won: here the soi the edge sits on is the answer.
    const roads = collection(
      road([at(-30, -10), at(70, -10)], { name: 'Parallel Road', widthEst: 14, widthSrc: 'est' }),
      road([at(20, -2), at(20, -30)], { name: 'Cross Soi', widthEst: 6, widthSrc: 'est' }),
    );
    expect(suggestRoadWidth(PLOT, 0, roads)?.roadName).toBe('Cross Soi');
  });

  it('picks the soi the edge abuts, not a parallel 30 m road 35 m away', () => {
    const roads = collection(
      road([at(-30, -5), at(70, -5)], { name: 'Soi', widthEst: 6, widthSrc: 'est' }),
      road([at(-30, -35), at(70, -35)], { name: 'Main Road', widthEst: 30, widthSrc: 'est' }),
    );
    expect(suggestRoadWidth(PLOT, 0, roads)?.roadName).toBe('Soi');
  });

  it('returns null rather than a road too far away to abut the edge', () => {
    // A 30 m road reaches 15 m from its centreline; 35 m away it cannot touch the plot.
    const roads = collection(road([at(-30, -35), at(70, -35)], { name: 'Main Road', widthEst: 30, widthSrc: 'est' }));
    expect(suggestRoadWidth(PLOT, 0, roads)).toBeNull();
  });

  it('reports a tagged width as tag', () => {
    const roads = collection(road([at(-30, -8), at(70, -8)], { name: 'Tagged', widthEst: 20, widthSrc: 'tag' }));
    expect(suggestRoadWidth(PLOT, 0, roads)?.source).toBe('tag');
  });

  it('ignores a road on the inner side of the edge', () => {
    const roads = collection(road([at(-30, 15), at(70, 15)], { name: 'Inside', widthEst: 10, widthSrc: 'est' }));
    expect(suggestRoadWidth(PLOT, 0, roads)).toBeNull();
  });

  it('returns null when nothing is within range', () => {
    const roads = collection(road([at(-30, -60), at(70, -60)], { name: 'Far', widthEst: 10, widthSrc: 'est' }));
    expect(suggestRoadWidth(PLOT, 0, roads)).toBeNull();
    expect(suggestRoadWidth(PLOT, 0, collection())).toBeNull();
  });

  it('uses the outward side of every edge', () => {
    const roads = collection(road([at(52, -30), at(52, 70)], { name: 'East Road', widthEst: 12, widthSrc: 'est' }));
    expect(suggestRoadWidth(PLOT, 1, roads)?.roadName).toBe('East Road');
    expect(suggestRoadWidth(PLOT, 3, roads)).toBeNull();
  });

  it('skips roads with no usable width and handles bad edge indexes', () => {
    const roads = collection(road([at(-30, -8), at(70, -8)], { name: 'No width' }));
    expect(suggestRoadWidth(PLOT, 0, roads)).toBeNull();
    expect(suggestRoadWidth(PLOT, 9, roads)).toBeNull();
  });
});

describe('suggestRoadWidth on the real road data', () => {
  const files = import.meta.glob('../../public/data/roads.geojson', { query: '?raw', import: 'default', eager: true });
  const raw = Object.values(files)[0] as string;
  const roads = JSON.parse(raw) as RoadCollection;

  it('finds Sukhumvit Road for the Sukhumvit frontage preset, in a few milliseconds', () => {
    const preset = PRESETS.find((candidate) => candidate.id === 'sukhumvit-wide-frontage');
    const edgeIndex = preset?.edges.findIndex((edge) => edge.kind === 'road') ?? -1;
    expect(preset).toBeDefined();
    const start = performance.now();
    const result = suggestRoadWidth(preset?.plot ?? [], edgeIndex, roads);
    const elapsed = performance.now() - start;
    expect(result?.roadName).toContain('Sukhumvit');
    expect(result?.widthM ?? 0).toBeGreaterThanOrEqual(20);
    expect(elapsed).toBeLessThan(50);
  });
});

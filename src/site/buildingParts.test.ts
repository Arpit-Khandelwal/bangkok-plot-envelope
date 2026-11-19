import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';
import { BUILDING_PARTS, PART_ID_STRIDE, partOfBuilding, readBuildingIndex, withPartIds } from './buildingParts';

describe('readBuildingIndex', () => {
  it('reads each part with its url, box and count', () => {
    const parts = readBuildingIndex({ parts: [{ file: 'part-00.geojson', bbox: [1, 2, 3, 4], count: 5 }] });
    expect(parts).toEqual([{ index: 0, url: '/data/buildings/part-00.geojson', bbox: [1, 2, 3, 4], count: 5 }]);
  });

  it('rejects an index without parts or with a malformed entry', () => {
    expect(() => readBuildingIndex({})).toThrow(/no parts/);
    expect(() => readBuildingIndex({ parts: [{ file: 'a', bbox: [1, 2, 3], count: 1 }] })).toThrow(/entry 0/);
    expect(() => readBuildingIndex({ parts: [{ file: 'a', bbox: [1, 2, 3, 4], count: PART_ID_STRIDE }] })).toThrow();
  });
});

describe('building ids', () => {
  const collection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [0, 1].map((n) => ({
      type: 'Feature',
      properties: { h: 10 + n, hSrc: 'sat' },
      geometry: { type: 'Point', coordinates: [n, n] },
    })),
  };

  it('are unique per part and independent of arrival order', () => {
    const ids = withPartIds(collection, 3).features.map((feature) => feature.properties.i);
    expect(ids).toEqual([3 * PART_ID_STRIDE, 3 * PART_ID_STRIDE + 1]);
    expect(ids.map(partOfBuilding)).toEqual([3, 3]);
  });

  it('keep the other properties and leave the input untouched', () => {
    const [first] = withPartIds(collection, 0).features;
    expect(first?.properties).toEqual({ h: 10, hSrc: 'sat', i: 0 });
    expect(collection.features[0]?.properties).toEqual({ h: 10, hSrc: 'sat' });
  });
});

describe('the bundled index', () => {
  it('lists every baked part with its true feature count', () => {
    expect(BUILDING_PARTS).toHaveLength(11);
    BUILDING_PARTS.forEach((part) => {
      const raw = JSON.parse(readFileSync(join(process.cwd(), 'public', part.url), 'utf8')) as FeatureCollection;
      expect(raw.features.length).toBe(part.count);
    });
  });
});

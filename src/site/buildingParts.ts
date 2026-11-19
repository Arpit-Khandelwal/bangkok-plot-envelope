/**
 * The surrounding buildings are baked as spatial parts (public/data/buildings). The small index
 * is bundled, so the nearest part can be requested without a round trip for the index first.
 */
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import buildingsIndex from '../../public/data/buildings/index.json';
import type { BuildingProperties } from './siteData';
import type { Bbox } from './studyArea';

export interface BuildingPart {
  /** Position in the index; also fixes the part's building ids. */
  readonly index: number;
  readonly url: string;
  readonly bbox: Bbox;
  readonly count: number;
}

export type BuildingCollection = FeatureCollection<Geometry, BuildingProperties>;

const BUILDINGS_DIRECTORY = '/data/buildings';

/**
 * Building ids are `part index * PART_ID_STRIDE + position in the part`, so they are unique and do
 * not depend on the order in which the parts arrive.
 */
export const PART_ID_STRIDE = 100_000;

function isBbox(value: unknown): value is Bbox {
  return Array.isArray(value) && value.length === 4 && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}

/** Validates the index shape. Exported for tests; the app uses `BUILDING_PARTS`. */
export function readBuildingIndex(index: unknown): BuildingPart[] {
  const parts = (index as { parts?: unknown } | null)?.parts;
  if (!Array.isArray(parts)) throw new Error('buildings index has no parts list');
  return parts.map((entry: unknown, position): BuildingPart => {
    const { file, bbox, count } = (entry ?? {}) as { file?: unknown; bbox?: unknown; count?: unknown };
    if (typeof file !== 'string' || !isBbox(bbox) || typeof count !== 'number' || count >= PART_ID_STRIDE) {
      throw new Error(`buildings index entry ${position} is malformed`);
    }
    return { index: position, url: `${BUILDINGS_DIRECTORY}/${file}`, bbox, count };
  });
}

export const BUILDING_PARTS: readonly BuildingPart[] = readBuildingIndex(buildingsIndex);

/** The part a building id belongs to. */
export function partOfBuilding(id: number): number {
  return Math.floor(id / PART_ID_STRIDE);
}

/** Copies the part's features with their ids in the `i` property. */
export function withPartIds(collection: FeatureCollection, partIndex: number): BuildingCollection {
  const base = partIndex * PART_ID_STRIDE;
  return {
    type: 'FeatureCollection',
    features: collection.features.map(
      (feature, position): Feature<Geometry, BuildingProperties> => ({
        ...feature,
        properties: { ...(feature.properties as Omit<BuildingProperties, 'i'>), i: base + position },
      }),
    ),
  };
}

/** Fetches and parses one part. Rejects on a network error, a bad status or a body that is not GeoJSON. */
export async function fetchBuildingPart(part: BuildingPart, signal?: AbortSignal): Promise<BuildingCollection> {
  const response = await fetch(part.url, { signal });
  if (!response.ok) throw new Error(`${part.url} returned ${response.status}`);
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || (body as { type?: unknown }).type !== 'FeatureCollection') {
    throw new Error(`${part.url} is not a GeoJSON FeatureCollection`);
  }
  return withPartIds(body as FeatureCollection, part.index);
}

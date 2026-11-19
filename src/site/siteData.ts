import type { Feature, FeatureCollection, Geometry } from 'geojson';

export interface BuildingProperties {
  /** Height in metres. */
  readonly h: number;
  /**
   * Where the height came from: a tagged height, a storey count, a satellite-derived
   * measurement (Google Open Buildings 2.5D), or our estimate where none of those exist.
   */
  readonly hSrc: 'height' | 'levels' | 'sat' | 'est';
  /** Index assigned on load, used to hide buildings that stand on the plot. */
  readonly i: number;
}

export interface ZoneProperties {
  readonly id: number;
  /** Zone code as printed in the plan, e.g. "ย.7". */
  readonly zone: string;
  readonly category: string;
  readonly planVersion: string;
}

export interface StationProperties {
  readonly name: string;
  readonly nameTh?: string;
  readonly ref?: string;
  readonly geomSource: 'platform' | 'node';
}

export interface SiteData {
  readonly buildings: FeatureCollection<Geometry, BuildingProperties>;
  readonly zones: FeatureCollection<Geometry, ZoneProperties>;
  readonly stations: FeatureCollection<Geometry, StationProperties>;
}

const BUILDINGS_DIRECTORY = '/data/buildings';

const DATA_FILES = {
  zones: '/data/zones.geojson',
  stations: '/data/stations.geojson',
} as const;

async function fetchCollection(url: string): Promise<FeatureCollection> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || (body as { type?: unknown }).type !== 'FeatureCollection') {
    throw new Error(`${url} is not a GeoJSON FeatureCollection`);
  }
  return body as FeatureCollection;
}

interface BuildingsIndex {
  readonly parts: readonly { readonly file: string }[];
}

/** Buildings are baked as several spatial chunks so no file is large. They load in parallel. */
async function fetchBuildings(): Promise<FeatureCollection> {
  const response = await fetch(`${BUILDINGS_DIRECTORY}/index.json`);
  if (!response.ok) throw new Error(`buildings index returned ${response.status}`);
  const index = (await response.json()) as BuildingsIndex;
  if (!Array.isArray(index.parts)) throw new Error('buildings index has no parts list');
  const parts = await Promise.all(index.parts.map((part) => fetchCollection(`${BUILDINGS_DIRECTORY}/${part.file}`)));
  return { type: 'FeatureCollection', features: parts.flatMap((part) => part.features) };
}

function withIndex(collection: FeatureCollection): FeatureCollection<Geometry, BuildingProperties> {
  return {
    type: 'FeatureCollection',
    features: collection.features.map(
      (feature, index): Feature<Geometry, BuildingProperties> => ({
        ...feature,
        properties: { ...(feature.properties as Omit<BuildingProperties, 'i'>), i: index },
      }),
    ),
  };
}

let cached: Promise<SiteData> | null = null;

/** Loads the baked site data once. Both the map layers and the zone lookup share it. */
export function loadSiteData(): Promise<SiteData> {
  if (!cached) {
    cached = Promise.all([
      fetchBuildings(),
      fetchCollection(DATA_FILES.zones),
      fetchCollection(DATA_FILES.stations),
    ])
      .then(
        ([buildings, zones, stations]): SiteData => ({
          buildings: withIndex(buildings),
          zones: zones as FeatureCollection<Geometry, ZoneProperties>,
          stations: stations as FeatureCollection<Geometry, StationProperties>,
        }),
      )
      .catch((error: unknown) => {
        // Let a later call retry instead of caching the failure.
        cached = null;
        throw error;
      });
  }
  return cached;
}

import type { FeatureCollection, Geometry } from 'geojson';
import type { RoadCollection } from './roadWidth';

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
  /**
   * Not loaded here: the map streams the surrounding buildings part by part (see
   * buildingParts.ts and map/buildingLoader.ts), so nothing else waits for 6.6 MB of footprints.
   */
  readonly buildings?: FeatureCollection<Geometry, BuildingProperties>;
  readonly zones: FeatureCollection<Geometry, ZoneProperties>;
  readonly stations: FeatureCollection<Geometry, StationProperties>;
  /** Road centrelines with estimated widths. Null when they could not be loaded: the tool works without them. */
  readonly roads?: RoadCollection | null;
}

const DATA_FILES = {
  zones: '/data/zones.geojson',
  stations: '/data/stations.geojson',
} as const;

const ROADS_URL = '/data/roads.geojson';

async function fetchCollection(url: string): Promise<FeatureCollection> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || (body as { type?: unknown }).type !== 'FeatureCollection') {
    throw new Error(`${url} is not a GeoJSON FeatureCollection`);
  }
  return body as FeatureCollection;
}

let cachedRoads: Promise<RoadCollection | null> | null = null;

/** Road centrelines, loaded once. Roads are optional: a failure gives null, never an error. */
export function loadRoads(): Promise<RoadCollection | null> {
  if (!cachedRoads) {
    cachedRoads = fetchCollection(ROADS_URL)
      .then((roads): RoadCollection | null => roads as RoadCollection)
      .catch((): null => null);
  }
  return cachedRoads;
}

let cached: Promise<SiteData> | null = null;

/** Loads the plan zones, stations and roads once. Both the map layers and the zone lookup share it. */
export function loadSiteData(): Promise<SiteData> {
  if (!cached) {
    cached = Promise.all([fetchCollection(DATA_FILES.zones), fetchCollection(DATA_FILES.stations), loadRoads()])
      .then(
        ([zones, stations, roads]): SiteData => ({
          zones: zones as FeatureCollection<Geometry, ZoneProperties>,
          stations: stations as FeatureCollection<Geometry, StationProperties>,
          roads,
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

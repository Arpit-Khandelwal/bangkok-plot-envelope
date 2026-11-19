import type { Feature, Geometry, Position } from 'geojson';
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { LngLat } from '../core/types';
import { loadSiteData } from '../site/siteData';
import type { BuildingProperties, SiteData } from '../site/siteData';

const BUILDINGS_SOURCE = 'context-buildings';
const ZONES_SOURCE = 'plan-zones';
const STATIONS_SOURCE = 'transit-stations';
const KNOWN_BUILDINGS_LAYER = 'context-buildings-known';
const ESTIMATED_BUILDINGS_LAYER = 'context-buildings-estimated';

/** The zone this tool covers. Its outline is drawn so the user can see where coverage ends. */
const COVERED_ZONE = 'ย.7';
/** The plan's own colour for medium-density residential zones. */
const ZONE_ORANGE = '#e8862e';
const CARD_KNOWN = '#d3d8d6';
const CARD_ESTIMATED = '#e4e7e5';
const STATION_INK = '#12303a';
const LABEL_FONT = ['Noto Sans Regular'];

let siteData: SiteData | null = null;

const isEstimated: ExpressionSpecification = ['==', ['get', 'hSrc'], 'est'];

function buildingFilter(base: ExpressionSpecification, hiddenIndexes: readonly number[]): ExpressionSpecification {
  if (hiddenIndexes.length === 0) return base;
  return ['all', base, ['!', ['in', ['get', 'i'], ['literal', [...hiddenIndexes]]]]];
}

/** Adds the real surroundings: buildings as extruded blocks, the plan zone outline, transit stations. */
export async function addContextLayers(map: MapLibreMap): Promise<void> {
  const data = await loadSiteData();
  siteData = data;

  map.addSource(ZONES_SOURCE, { type: 'geojson', data: data.zones });
  map.addLayer({
    id: 'plan-zone-covered-fill',
    type: 'fill',
    source: ZONES_SOURCE,
    filter: ['==', ['get', 'zone'], COVERED_ZONE],
    paint: { 'fill-color': ZONE_ORANGE, 'fill-opacity': 0.07 },
  });
  map.addLayer({
    id: 'plan-zone-covered-outline',
    type: 'line',
    source: ZONES_SOURCE,
    filter: ['==', ['get', 'zone'], COVERED_ZONE],
    paint: { 'line-color': ZONE_ORANGE, 'line-width': 1.5, 'line-dasharray': [3, 2] },
  });

  map.addSource(BUILDINGS_SOURCE, { type: 'geojson', data: data.buildings });
  map.addLayer({
    id: KNOWN_BUILDINGS_LAYER,
    type: 'fill-extrusion',
    source: BUILDINGS_SOURCE,
    filter: ['!', isEstimated],
    paint: {
      'fill-extrusion-color': CARD_KNOWN,
      'fill-extrusion-height': ['get', 'h'],
      'fill-extrusion-opacity': 0.95,
      'fill-extrusion-vertical-gradient': true,
    },
  });
  map.addLayer({
    id: ESTIMATED_BUILDINGS_LAYER,
    type: 'fill-extrusion',
    source: BUILDINGS_SOURCE,
    filter: isEstimated,
    paint: {
      'fill-extrusion-color': CARD_ESTIMATED,
      'fill-extrusion-height': ['get', 'h'],
      'fill-extrusion-opacity': 0.8,
      'fill-extrusion-vertical-gradient': true,
    },
  });

  map.addSource(STATIONS_SOURCE, { type: 'geojson', data: data.stations });
  map.addLayer({
    id: 'transit-platforms',
    type: 'line',
    source: STATIONS_SOURCE,
    filter: ['!=', ['geometry-type'], 'Point'],
    paint: { 'line-color': STATION_INK, 'line-width': 3 },
  });
  map.addLayer({
    id: 'transit-stations',
    type: 'symbol',
    source: STATIONS_SOURCE,
    layout: {
      'text-field': ['concat', ['coalesce', ['get', 'ref'], ''], ' ', ['get', 'name']],
      'text-font': LABEL_FONT,
      'text-size': 12,
      'text-anchor': 'top',
      'text-offset': [0, 0.6],
      'symbol-placement': 'point',
    },
    paint: { 'text-color': STATION_INK, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  });
}

function ringContains(ring: readonly LngLat[], point: Position): boolean {
  const x = point[0] ?? 0;
  const y = point[1] ?? 0;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const a = ring[index];
    const b = ring[previous];
    if (!a || !b) continue;
    const crosses = a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function outerRing(geometry: Geometry): Position[] {
  if (geometry.type === 'Polygon') return geometry.coordinates[0] ?? [];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates[0]?.[0] ?? [];
  return [];
}

function centre(ring: readonly Position[]): Position {
  const total = ring.reduce<[number, number]>((sum, point) => [sum[0] + (point[0] ?? 0), sum[1] + (point[1] ?? 0)], [0, 0]);
  return [total[0] / Math.max(ring.length, 1), total[1] / Math.max(ring.length, 1)];
}

function standsOnPlot(feature: Feature<Geometry, BuildingProperties>, plot: readonly LngLat[]): boolean {
  const ring = outerRing(feature.geometry);
  return ring.length > 0 && ringContains(plot, centre(ring));
}

/**
 * Hides existing buildings whose centre is on the plot. A developer assessing the plot
 * assumes it will be cleared, and the old building would otherwise poke through the proposal.
 */
export function hideBuildingsInside(map: MapLibreMap, plot: readonly LngLat[] | null): void {
  if (!siteData || !map.getLayer(KNOWN_BUILDINGS_LAYER) || !map.getSource<GeoJSONSource>(BUILDINGS_SOURCE)) return;
  const hidden = plot
    ? siteData.buildings.features.filter((feature) => standsOnPlot(feature, plot)).map((feature) => feature.properties.i)
    : [];
  map.setFilter(KNOWN_BUILDINGS_LAYER, buildingFilter(['!', isEstimated], hidden));
  map.setFilter(ESTIMATED_BUILDINGS_LAYER, buildingFilter(isEstimated, hidden));
}

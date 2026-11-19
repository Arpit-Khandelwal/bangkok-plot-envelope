import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { LngLat } from '../core/types';
import { loadSiteData } from '../site/siteData';
import { buildingsOnPlot, indexFootprints, type BuildingFootprint } from './buildingsOnPlot';

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

/** Building footprints with bounding boxes, built once when the data arrives. */
let footprints: readonly BuildingFootprint[] | null = null;
/** The ids hidden last time, so an edit that hides the same buildings skips re-filtering. */
let lastHiddenKey: string | null = null;

const isEstimated: ExpressionSpecification = ['==', ['get', 'hSrc'], 'est'];

function buildingFilter(base: ExpressionSpecification, hiddenIndexes: readonly number[]): ExpressionSpecification {
  if (hiddenIndexes.length === 0) return base;
  return ['all', base, ['!', ['in', ['get', 'i'], ['literal', [...hiddenIndexes]]]]];
}

/** Adds the real surroundings: buildings as extruded blocks, the plan zone outline, transit stations. */
export async function addContextLayers(map: MapLibreMap): Promise<void> {
  const data = await loadSiteData();
  footprints = indexFootprints(data.buildings.features);
  lastHiddenKey = null;

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

/**
 * Hides existing buildings that stand on the plot (see `buildingsOnPlot` for the test). A
 * developer assessing the plot assumes it will be cleared, and the old building would otherwise
 * swallow the proposal.
 */
export function hideBuildingsInside(map: MapLibreMap, plot: readonly LngLat[] | null): void {
  if (!footprints || !map.getLayer(KNOWN_BUILDINGS_LAYER) || !map.getSource<GeoJSONSource>(BUILDINGS_SOURCE)) return;
  const hidden = plot ? buildingsOnPlot(footprints, plot).sort((a, b) => a - b) : [];
  // Each setFilter re-filters the whole buildings source, and corner drags call this constantly.
  const hiddenKey = hidden.join(',');
  if (hiddenKey === lastHiddenKey) return;
  lastHiddenKey = hiddenKey;
  map.setFilter(KNOWN_BUILDINGS_LAYER, buildingFilter(['!', isEstimated], hidden));
  map.setFilter(ESTIMATED_BUILDINGS_LAYER, buildingFilter(isEstimated, hidden));
}

/** Prefix of the layers terra-draw adds for the drawn outline and its handles. */
const DRAW_LAYER_PREFIX = 'td-';

/**
 * Puts the given custom layer, then the drawing layers, above the building extrusions. The
 * buildings load asynchronously and so are added last; left there they would paint over the
 * proposal's see-through outline and over the drawn plot outline. Safe to call repeatedly.
 */
export function raiseOverlayLayers(map: MapLibreMap, modelLayerId: string): void {
  if (map.getLayer(modelLayerId)) map.moveLayer(modelLayerId);
  const drawLayerIds = (map.getStyle()?.layers ?? [])
    .map((layer) => layer.id)
    .filter((id) => id.startsWith(DRAW_LAYER_PREFIX));
  // Moving each to the top in their existing order keeps their order relative to each other.
  drawLayerIds.forEach((id) => map.moveLayer(id));
}

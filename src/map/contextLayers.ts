import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { LngLat } from '../core/types';
import { partOfBuilding, type BuildingCollection } from '../site/buildingParts';
import type { SiteData } from '../site/siteData';
import { buildingsOnPlot, indexFootprints, type BuildingFootprint } from './buildingsOnPlot';
import { MODEL_LAYER_ID } from './modelLayer';

const ZONES_SOURCE = 'plan-zones';
const STATIONS_SOURCE = 'transit-stations';
const ZONE_FILL_LAYER = 'plan-zone-covered-fill';
const ZONE_OUTLINE_LAYER = 'plan-zone-covered-outline';
const PLATFORMS_LAYER = 'transit-platforms';
const STATIONS_LAYER = 'transit-stations';

/** The zone this tool covers. Its outline is drawn so the user can see where coverage ends. */
const COVERED_ZONE = 'ย.7';
/** The plan's own colour for medium-density residential zones. */
const ZONE_ORANGE = '#e8862e';
/** Darker than the fill so the dashed zone edge keeps 3:1 contrast against the basemap; matches the legend. */
const ZONE_LINE = '#b45a00';
const CARD_KNOWN = '#d3d8d6';
const CARD_ESTIMATED = '#e4e7e5';
const STATION_INK = '#12303a';
const LABEL_FONT = ['Noto Sans Regular'];

const isEstimated: ExpressionSpecification = ['==', ['get', 'hSrc'], 'est'];

function buildingFilter(base: ExpressionSpecification, hiddenIds: readonly number[]): ExpressionSpecification {
  if (hiddenIds.length === 0) return base;
  return ['all', base, ['!', ['in', ['get', 'i'], ['literal', [...hiddenIds]]]]];
}

const sourceId = (part: number): string => `context-buildings-${part}`;
const knownLayerId = (part: number): string => `context-buildings-known-${part}`;
const estimatedLayerId = (part: number): string => `context-buildings-estimated-${part}`;

/** The loaded buildings and those hidden on the plot, for choosing a clear camera view. */
export interface BuildingContext {
  readonly buildings: readonly BuildingFootprint[];
  readonly hiddenIds: ReadonlySet<number>;
}

interface LoadedPart {
  readonly footprints: readonly BuildingFootprint[];
  /** Kept until the style is ready and the part's layers are added; then dropped. */
  collection: BuildingCollection | null;
  /** Hidden ids last applied to this part's layers, joined. */
  appliedKey: string;
}

/**
 * The surrounding buildings, one GeoJSON source per part with two extrusion layers each. Each
 * part is parsed, sent to a worker and tiled exactly once; a single source updated with setData
 * would re-send and re-tile everything loaded so far on every arrival. Parts can arrive before
 * the style is ready: their footprints are usable for framing at once and their layers are added
 * when `attach` is called.
 */
export class BuildingLayers {
  private readonly parts = new Map<number, LoadedPart>();
  private map: MapLibreMap | null = null;
  private allFootprints: readonly BuildingFootprint[] = [];
  private plot: readonly LngLat[] | null = null;
  private hiddenIds: ReadonlySet<number> = new Set();

  /** Null until at least one part has loaded. */
  context(): BuildingContext | null {
    return this.parts.size > 0 ? { buildings: this.allFootprints, hiddenIds: this.hiddenIds } : null;
  }

  /** Adds the layers of parts that arrived before the style was ready. Call on `style.load`. */
  attach(map: MapLibreMap): void {
    this.map = map;
    this.parts.forEach((part, index) => this.addLayers(index, part));
  }

  addPart(index: number, collection: BuildingCollection): void {
    const footprints = indexFootprints(collection.features);
    const part: LoadedPart = { footprints, collection, appliedKey: '' };
    this.parts.set(index, part);
    this.allFootprints = [...this.parts.values()].flatMap((entry) => entry.footprints);
    if (this.plot) {
      const ownHidden = buildingsOnPlot(footprints, this.plot);
      if (ownHidden.length > 0) this.hiddenIds = new Set([...this.hiddenIds, ...ownHidden]);
    }
    if (this.map) this.addLayers(index, part);
  }

  /**
   * Hides existing buildings that stand on the plot (see `buildingsOnPlot` for the test). A
   * developer assessing the plot assumes it will be cleared, and the old building would otherwise
   * swallow the proposal. Only the parts whose hidden set changed are re-filtered.
   */
  hideInside(plot: readonly LngLat[] | null): void {
    this.plot = plot;
    const hidden = plot ? buildingsOnPlot(this.allFootprints, plot) : [];
    this.hiddenIds = new Set(hidden);
    this.parts.forEach((part, index) => this.applyFilter(index, part));
  }

  private hiddenInPart(index: number): number[] {
    return [...this.hiddenIds].filter((id) => partOfBuilding(id) === index).sort((a, b) => a - b);
  }

  private applyFilter(index: number, part: LoadedPart): void {
    const map = this.map;
    if (!map || part.collection !== null || !map.getLayer(knownLayerId(index))) return;
    const hidden = this.hiddenInPart(index);
    const key = hidden.join(',');
    // Each setFilter re-filters the part's tiles, and corner drags call this constantly.
    if (key === part.appliedKey) return;
    part.appliedKey = key;
    map.setFilter(knownLayerId(index), buildingFilter(['!', isEstimated], hidden));
    map.setFilter(estimatedLayerId(index), buildingFilter(isEstimated, hidden));
  }

  private addLayers(index: number, part: LoadedPart): void {
    const map = this.map;
    const data = part.collection;
    if (!map || !data) return;
    part.collection = null;
    const hidden = this.hiddenInPart(index);
    part.appliedKey = hidden.join(',');
    // Retried parts may have been added before; replace them.
    [knownLayerId(index), estimatedLayerId(index)].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(sourceId(index))) map.removeSource(sourceId(index));

    // Under the station lines and labels, the proposal and the drawn outline.
    const before = map.getLayer(PLATFORMS_LAYER) ? PLATFORMS_LAYER : beforeModel(map);
    map.addSource(sourceId(index), { type: 'geojson', data });
    map.addLayer(
      {
        id: knownLayerId(index),
        type: 'fill-extrusion',
        source: sourceId(index),
        filter: buildingFilter(['!', isEstimated], hidden),
        paint: {
          'fill-extrusion-color': CARD_KNOWN,
          'fill-extrusion-height': ['get', 'h'],
          'fill-extrusion-opacity': 0.95,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      before,
    );
    map.addLayer(
      {
        id: estimatedLayerId(index),
        type: 'fill-extrusion',
        source: sourceId(index),
        filter: buildingFilter(isEstimated, hidden),
        paint: {
          'fill-extrusion-color': CARD_ESTIMATED,
          'fill-extrusion-height': ['get', 'h'],
          'fill-extrusion-opacity': 0.8,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      before,
    );
  }
}

function beforeModel(map: MapLibreMap): string | undefined {
  return map.getLayer(MODEL_LAYER_ID) ? MODEL_LAYER_ID : undefined;
}

/** The lowest building layer, so the flat zone fill sits under every extrusion. */
function lowestBuildingLayer(map: MapLibreMap): string | undefined {
  return (map.getStyle()?.layers ?? []).find((layer) => layer.id.startsWith('context-buildings-'))?.id;
}

/** Adds the plan zone outline and the transit stations, under the proposal and the drawn outline. */
export function addZoneAndStationLayers(map: MapLibreMap, data: SiteData): void {
  const zonesBefore = lowestBuildingLayer(map) ?? beforeModel(map);
  map.addSource(ZONES_SOURCE, { type: 'geojson', data: data.zones });
  map.addLayer(
    {
      id: ZONE_FILL_LAYER,
      type: 'fill',
      source: ZONES_SOURCE,
      filter: ['==', ['get', 'zone'], COVERED_ZONE],
      paint: { 'fill-color': ZONE_ORANGE, 'fill-opacity': 0.07 },
    },
    zonesBefore,
  );
  map.addLayer(
    {
      id: ZONE_OUTLINE_LAYER,
      type: 'line',
      source: ZONES_SOURCE,
      filter: ['==', ['get', 'zone'], COVERED_ZONE],
      paint: { 'line-color': ZONE_LINE, 'line-width': 1.5, 'line-dasharray': [3, 2] },
    },
    zonesBefore,
  );

  const stationsBefore = beforeModel(map);
  map.addSource(STATIONS_SOURCE, { type: 'geojson', data: data.stations });
  map.addLayer(
    {
      id: PLATFORMS_LAYER,
      type: 'line',
      source: STATIONS_SOURCE,
      filter: ['!=', ['geometry-type'], 'Point'],
      paint: { 'line-color': STATION_INK, 'line-width': 3 },
    },
    stationsBefore,
  );
  map.addLayer(
    {
      id: STATIONS_LAYER,
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
    },
    stationsBefore,
  );
}

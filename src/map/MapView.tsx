import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { EdgeSpec, LngLat } from '../core/types';
import { useAppStore } from '../state/store';
import { addContextLayers, hideBuildingsInside } from './contextLayers';
import { edgeLetter, edgeSummary } from './edgeLabels';
import { ModelLayer } from './modelLayer';
import type { ModelContent } from './modelLayer';

// MapLibre 6 ships its worker as a separate ES module. Vite must bundle it and hand us the URL.
setWorkerUrl(maplibreWorkerUrl);

/** BTS Punnawithi, inside the zone ย.7 study area. */
const STUDY_AREA_CENTER: LngLat = [100.609, 13.6893];
const INITIAL_ZOOM = 16.4;
const INITIAL_PITCH = 55;
const INITIAL_BEARING = -20;
const MAX_PITCH = 78;
const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const FIT_PADDING_PX = 120;
const FIT_MAX_ZOOM = 18.2;

const PLOT_OUTLINE = '#12303a';
const PLOT_FILL = '#12303a';
const HANDLE_FILL = '#ffffff';

interface MapViewProps {
  /** The envelope and design meshes to draw, or null when there is nothing to show. */
  readonly model: ModelContent | null;
  readonly onDataError: (message: string) => void;
}

interface MapParts {
  readonly map: MapLibreMap;
  readonly modelLayer: ModelLayer;
  draw: TerraDraw | null;
}

function toOpenRing(closedRing: readonly (readonly number[])[]): LngLat[] {
  return closedRing.slice(0, -1).map((position) => [position[0] ?? 0, position[1] ?? 0] as const);
}

function midpoint(a: LngLat, b: LngLat): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function createEdgeChip(index: number, spec: EdgeSpec, isSelected: boolean, onSelect: () => void): HTMLButtonElement {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = `edge-chip edge-chip--${spec.kind}${isSelected ? ' edge-chip--selected' : ''}`;
  chip.setAttribute('aria-label', `Edge ${edgeLetter(index)}: ${edgeSummary(spec)}. Select to change.`);
  const letter = document.createElement('span');
  letter.className = 'edge-chip__letter';
  letter.textContent = edgeLetter(index);
  const summary = document.createElement('span');
  summary.className = 'edge-chip__summary';
  summary.textContent = edgeSummary(spec);
  chip.append(letter, summary);
  chip.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect();
  });
  return chip;
}

function createDraw(map: MapLibreMap): TerraDraw {
  return new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map }),
    modes: [
      new TerraDrawPolygonMode({
        styles: {
          fillColor: PLOT_FILL,
          fillOpacity: 0.12,
          outlineColor: PLOT_OUTLINE,
          outlineWidth: 2,
          closingPointColor: HANDLE_FILL,
          closingPointOutlineColor: PLOT_OUTLINE,
          closingPointOutlineWidth: 2,
          closingPointWidth: 6,
        },
      }),
      new TerraDrawSelectMode({
        flags: {
          polygon: {
            feature: {
              draggable: true,
              coordinates: { midpoints: true, draggable: true, deletable: true },
            },
          },
        },
        styles: {
          selectedPolygonColor: PLOT_FILL,
          selectedPolygonFillOpacity: 0.06,
          selectedPolygonOutlineColor: PLOT_OUTLINE,
          selectedPolygonOutlineWidth: 2,
          selectionPointColor: HANDLE_FILL,
          selectionPointOutlineColor: PLOT_OUTLINE,
          selectionPointOutlineWidth: 2,
          selectionPointWidth: 6,
          midPointColor: PLOT_OUTLINE,
          midPointOutlineColor: HANDLE_FILL,
          midPointOutlineWidth: 1,
          midPointWidth: 4,
        },
      }),
    ],
  });
}

function fitToPlot(map: MapLibreMap, plot: readonly LngLat[]): void {
  const lngs = plot.map((point) => point[0]);
  const lats = plot.map((point) => point[1]);
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding: FIT_PADDING_PX, maxZoom: FIT_MAX_ZOOM, pitch: INITIAL_PITCH, bearing: map.getBearing(), duration: 600 },
  );
}

export function MapView({ model, onDataError }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<MapParts | null>(null);
  const onDataErrorRef = useRef(onDataError);
  onDataErrorRef.current = onDataError;

  const plot = useAppStore((state) => state.plot);
  const edges = useAppStore((state) => state.edges);
  const selectedEdge = useAppStore((state) => state.selectedEdge);
  const plotRevision = useAppStore((state) => state.plotRevision);

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MapLibreMap({
      container,
      style: BASEMAP_STYLE_URL,
      center: [STUDY_AREA_CENTER[0], STUDY_AREA_CENTER[1]],
      zoom: INITIAL_ZOOM,
      pitch: INITIAL_PITCH,
      bearing: INITIAL_BEARING,
      maxPitch: MAX_PITCH,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-left');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    const parts: MapParts = { map, modelLayer: new ModelLayer(), draw: null };
    partsRef.current = parts;

    map.once('style.load', () => {
      addContextLayers(map).catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : 'unknown error';
        onDataErrorRef.current(`Surrounding buildings and zones could not be loaded (${detail}). Reload to try again.`);
      });
      map.addLayer(parts.modelLayer);

      const draw = createDraw(map);
      parts.draw = draw;
      draw.start();

      const publishPlot = (): void => {
        const finished = draw
          .getSnapshot()
          .find((feature) => feature.geometry.type === 'Polygon' && feature.properties.currentlyDrawing !== true);
        if (!finished || finished.geometry.type !== 'Polygon') return;
        const ring = finished.geometry.coordinates[0];
        if (ring && ring.length >= 4) useAppStore.getState().setPlotFromMap(toOpenRing(ring));
      };

      draw.on('finish', (id) => {
        publishPlot();
        draw.setMode('select');
        draw.selectFeature(id);
      });
      draw.on('change', (_ids, type) => {
        if (type !== 'delete') publishPlot();
      });

      syncDrawToStore(parts);
    });

    return () => {
      parts.draw?.stop();
      map.remove();
      partsRef.current = null;
    };
  }, []);

  // Redraw the outline when the plot is replaced from outside the map (a preset, or "start over").
  useEffect(() => {
    const parts = partsRef.current;
    if (parts?.draw) syncDrawToStore(parts);
  }, [plotRevision]);

  // Edge markers, one per plot edge.
  useEffect(() => {
    const map = partsRef.current?.map;
    if (!map || !plot) return;
    const markers = plot.map((start, index) => {
      const end = plot[(index + 1) % plot.length] ?? start;
      const spec = edges[index] ?? { kind: 'neighbour' };
      const chip = createEdgeChip(index, spec, selectedEdge === index, () => useAppStore.getState().selectEdge(index));
      return new Marker({ element: chip, anchor: 'center' }).setLngLat(midpoint(start, end)).addTo(map);
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [plot, edges, selectedEdge]);

  // Existing buildings on the plot would poke through the proposal, so they are hidden.
  useEffect(() => {
    const map = partsRef.current?.map;
    if (map) hideBuildingsInside(map, plot);
  }, [plot]);

  useEffect(() => {
    partsRef.current?.modelLayer.setContent(model);
  }, [model]);

  return <div ref={containerRef} className="map-root" data-testid="map" role="application" aria-label="Map of the site. Click to place the corners of the plot." />;
}

/** Makes the drawing tool show exactly the plot held in the store. */
function syncDrawToStore(parts: MapParts): void {
  const { draw, map } = parts;
  if (!draw) return;
  const { plot } = useAppStore.getState();
  draw.clear();
  if (!plot) {
    draw.setMode('polygon');
    return;
  }
  const first = plot[0];
  if (!first) return;
  const closedRing = [...plot, first].map((point) => [point[0], point[1]]);
  const results = draw.addFeatures([
    { type: 'Feature', properties: { mode: 'polygon' }, geometry: { type: 'Polygon', coordinates: [closedRing] } },
  ]);
  draw.setMode('select');
  const added = results.find((result) => result.valid && result.id !== undefined);
  if (added?.id !== undefined) draw.selectFeature(added.id);
  fitToPlot(map, plot);
}

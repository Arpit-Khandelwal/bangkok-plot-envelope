import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { LngLat } from '../core/types';
import { useAppStore } from '../state/store';
import { addContextLayers, hideBuildingsInside, raiseOverlayLayers } from './contextLayers';
import { exposeDebugHandle } from './debugHandle';
import { createEdgeMarkers, plotKey, setEdgeMarkerOffsets, updateEdgeMarker, type EdgeMarker } from './edgeMarkers';
import { NavigationWithFrameControl } from './frameControl';
import {
  FRAME_PITCH_DEGREES,
  framingStep,
  freeViewport,
  hasRoad,
  INITIAL_FRAMING,
  plotCamera,
  roadSideBearing,
  type FramingEvent,
  type FramingState,
  type ScreenRect,
} from './framing';
import { outwardOffsets } from './markerOffset';
import { MODEL_LAYER_ID, ModelLayer } from './modelLayer';
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
const FRAME_DURATION_MS = 900;
/** Overlays drawn over the map from 900 px up; framing keeps the plot clear of them. */
const MAP_OVERLAY_SELECTOR = '.site-bar, .legend';

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
  readonly navigation: NavigationWithFrameControl;
  draw: TerraDraw | null;
  framing: FramingState;
}

function toOpenRing(closedRing: readonly (readonly number[])[]): LngLat[] {
  return closedRing.slice(0, -1).map((position) => [position[0] ?? 0, position[1] ?? 0] as const);
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

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Overlay rectangles relative to the map container. */
function overlayRects(container: HTMLElement): ScreenRect[] {
  const box = container.getBoundingClientRect();
  return [...document.querySelectorAll<HTMLElement>(MAP_OVERLAY_SELECTOR)].map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left - box.left, top: rect.top - box.top, right: rect.right - box.left, bottom: rect.bottom - box.top };
  });
}

/**
 * Moves the camera so the plot fills about a third of the map left clear by the overlays,
 * pitched, and looking into the plot from its widest road (the current bearing if none).
 */
function framePlot(map: MapLibreMap): void {
  const { plot, edges } = useAppStore.getState();
  if (!plot || plot.length < 3) return;
  const container = map.getContainer();
  const width = container.clientWidth;
  const height = container.clientHeight;
  const bearing = roadSideBearing(plot, edges) ?? map.getBearing();
  const free = freeViewport(width, height, overlayRects(container));
  const camera = plotCamera({ plot, bearing, pitch: FRAME_PITCH_DEGREES, width, height, free });
  if (!camera) return;
  map.easeTo({
    center: [camera.center[0], camera.center[1]],
    zoom: camera.zoom,
    bearing,
    pitch: FRAME_PITCH_DEGREES,
    offset: [camera.offset[0], camera.offset[1]],
    duration: prefersReducedMotion() ? 0 : FRAME_DURATION_MS,
  });
}

function applyFraming(parts: MapParts, event: FramingEvent): void {
  const step = framingStep(parts.framing, event);
  parts.framing = step.state;
  if (step.frame) framePlot(parts.map);
}

export function MapView({ model, onDataError }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<MapParts | null>(null);
  const markersRef = useRef<readonly EdgeMarker[]>([]);
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
    const navigation = new NavigationWithFrameControl(new NavigationControl({ visualizePitch: true }), () =>
      framePlot(map),
    );
    navigation.setEnabled(useAppStore.getState().plot !== null);
    map.addControl(navigation, 'bottom-left');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    const parts: MapParts = { map, modelLayer: new ModelLayer(), navigation, draw: null, framing: INITIAL_FRAMING };
    partsRef.current = parts;
    const removeDebugHandle = exposeDebugHandle(window, window.location.search, map);
    let isRemoved = false;

    map.once('style.load', () => {
      map.addLayer(parts.modelLayer);
      addContextLayers(map)
        .then(() => {
          if (isRemoved) return;
          // The buildings arrive last; lift the model and the drawn outline back above them.
          raiseOverlayLayers(map, MODEL_LAYER_ID);
          hideBuildingsInside(map, useAppStore.getState().plot);
        })
        .catch((error: unknown) => {
          if (isRemoved) return;
          const detail = error instanceof Error ? error.message : 'unknown error';
          onDataErrorRef.current(`Surrounding buildings and zones could not be loaded (${detail}). Reload to try again.`);
        });

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

      draw.on('finish', (id, context) => {
        publishPlot();
        draw.setMode('select');
        draw.selectFeature(id);
        // 'finish' also follows corner drags and inserted corners; only a closed drawing frames.
        if (context.action === 'draw') {
          applyFraming(parts, { type: 'drawn', hasRoad: hasRoad(useAppStore.getState().edges) });
        }
      });
      draw.on('change', (_ids, type) => {
        if (type !== 'delete') publishPlot();
      });

      syncDrawToStore(parts);
    });

    return () => {
      isRemoved = true;
      removeDebugHandle();
      parts.draw?.stop();
      map.remove();
      partsRef.current = null;
    };
  }, []);

  // Redraw the outline when the plot is replaced from outside the map (a preset, or "start over"),
  // and frame a newly loaded preset. Declared before the edge effect, which must see this first.
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts) return;
    if (parts.draw) syncDrawToStore(parts);
    if (plotRevision === 0) return;
    applyFraming(parts, useAppStore.getState().plot ? { type: 'preset' } : { type: 'cleared' });
  }, [plotRevision]);

  // The first road marked on a freshly drawn plot re-frames once; other edge edits never do.
  useEffect(() => {
    const parts = partsRef.current;
    if (parts) applyFraming(parts, { type: 'edges', hasRoad: hasRoad(edges) });
  }, [edges]);

  const hasPlot = plot !== null;
  useEffect(() => {
    partsRef.current?.navigation.setEnabled(hasPlot);
  }, [hasPlot]);

  // Edge markers are rebuilt only when the corners move, so a focused marker stays focused.
  const cornersKey = plotKey(plot);
  useEffect(() => {
    const map = partsRef.current?.map;
    const corners = useAppStore.getState().plot;
    if (!map || !corners) return;
    const created = createEdgeMarkers(map, corners, (index) => useAppStore.getState().selectEdge(index));
    markersRef.current = created;
    // Outward is a screen-space direction, so it changes as the map rotates and pitches. 'move'
    // fires once per rendered frame for pans, zooms, rotations and pitch changes alike, and
    // MapLibre repositions the markers in the same event, so this adds no lag.
    const placeChips = (): void => {
      const screen = corners.map((corner) => map.project([corner[0], corner[1]]));
      setEdgeMarkerOffsets(created, outwardOffsets(screen));
    };
    placeChips();
    map.on('move', placeChips);
    map.on('resize', placeChips);
    return () => {
      map.off('move', placeChips);
      map.off('resize', placeChips);
      created.forEach((entry) => entry.marker.remove());
      markersRef.current = [];
    };
  }, [cornersKey]);

  // Edge settings and the selection only change the markers' text and classes.
  useEffect(() => {
    markersRef.current.forEach((entry, index) =>
      updateEdgeMarker(entry, index, edges[index] ?? { kind: 'neighbour' }, selectedEdge === index),
    );
  }, [cornersKey, edges, selectedEdge]);

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
  const { draw } = parts;
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
}

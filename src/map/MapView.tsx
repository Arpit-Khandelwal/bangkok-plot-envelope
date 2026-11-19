import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { LngLat } from '../core/types';
import { useAppStore } from '../state/store';
import { addContextLayers, buildingContext, hideBuildingsInside, raiseOverlayLayers } from './contextLayers';
import { exposeDebugHandle } from './debugHandle';
import { createDraw, linkDraw, writeStoreToDraw, type DrawLink } from './drawSync';
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
import { chooseView } from './viewChoice';
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

interface MapViewProps {
  /** The envelope and design meshes to draw, or null when there is nothing to show. */
  readonly model: ModelContent | null;
  readonly onDataError: (message: string) => void;
}

interface MapParts {
  readonly map: MapLibreMap;
  readonly modelLayer: ModelLayer;
  readonly navigation: NavigationWithFrameControl;
  drawLink: DrawLink | null;
  framing: FramingState;
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
 * Moves the camera so the plot fills about a third of the map left clear by the overlays, from
 * the view where surrounding buildings hide least of it (see `chooseView`; ties go to the road
 * side). Before the buildings load it simply looks in from the widest road.
 */
function framePlot(map: MapLibreMap): void {
  const { plot, edges } = useAppStore.getState();
  if (!plot || plot.length < 3) return;
  const container = map.getContainer();
  const width = container.clientWidth;
  const height = container.clientHeight;
  // Hidden on-plot buildings must already be excluded, so bring the filter up to date first.
  hideBuildingsInside(map, plot);
  const context = buildingContext();
  const { bearing, pitch } = context
    ? chooseView({ plot, edges, ...context, currentBearing: map.getBearing() })
    : { bearing: roadSideBearing(plot, edges) ?? map.getBearing(), pitch: FRAME_PITCH_DEGREES };
  const free = freeViewport(width, height, overlayRects(container));
  const camera = plotCamera({ plot, bearing, pitch, width, height, free });
  if (!camera) return;
  map.easeTo({
    center: [camera.center[0], camera.center[1]],
    zoom: camera.zoom,
    bearing,
    pitch,
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

    const parts: MapParts = { map, modelLayer: new ModelLayer(), navigation, drawLink: null, framing: INITIAL_FRAMING };
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

      const draw = createDraw(new TerraDrawMapLibreGLAdapter({ map }));
      draw.start();
      parts.drawLink = linkDraw(draw, () =>
        applyFraming(parts, { type: 'drawn', hasRoad: hasRoad(useAppStore.getState().edges) }),
      );

      writeStoreToDraw(parts.drawLink);
    });

    return () => {
      isRemoved = true;
      removeDebugHandle();
      parts.drawLink?.draw.stop();
      map.remove();
      partsRef.current = null;
    };
  }, []);

  // Redraw the outline when the plot is replaced from outside the map (a preset, or "start over"),
  // and frame a newly loaded preset. Declared before the edge effect, which must see this first.
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts) return;
    if (parts.drawLink) writeStoreToDraw(parts.drawLink);
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

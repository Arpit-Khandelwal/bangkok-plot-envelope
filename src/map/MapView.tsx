import { useCallback, useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { LngLat } from '../core/types';
import { BUILDING_PARTS, fetchBuildingPart } from '../site/buildingParts';
import { loadSiteData } from '../site/siteData';
import { isInsideStudyArea, OUTSIDE_STUDY_AREA_NOTE, plotCentroid } from '../site/studyArea';
import { useAppStore } from '../state/store';
import { decodeScenario } from '../state/urlState';
import { MapStatus } from '../ui/status/MapStatus';
import { mapStatusMessage } from '../ui/status/statusText';
import { collapseAttributionOnSmallScreens } from './attribution';
import { createBuildingLoader, type BuildingLoader, type LoadProgress } from './buildingLoader';
import { addZoneAndStationLayers, BuildingLayers } from './contextLayers';
import { exposeDebugHandle } from './debugHandle';
import type { DrawHandle } from './drawSetup';
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
import { ModelLayer } from './modelLayer';
import { partsAround, shouldReframe } from './partOrder';
import { chooseView, OCCLUDER_RANGE_M } from './viewChoice';
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
/** How long the three.js download may wait for an idle moment after the map has loaded. */
const MODEL_PRELOAD_TIMEOUT_MS = 3000;

interface MapViewProps {
  /** The envelope and design meshes to draw, or null when there is nothing to show. */
  readonly model: ModelContent | null;
  /** Shows a data problem in the panel; null clears it (after a successful "Try again"). */
  readonly onDataError: (message: string | null) => void;
}

interface ReframeState {
  /** Key of a plot framed before the buildings around it had arrived. */
  readonly pendingPlotKey: string | null;
  /** The user has moved the camera since the app last framed. */
  readonly userMoved: boolean;
}

interface MapParts {
  readonly map: MapLibreMap;
  readonly modelLayer: ModelLayer;
  readonly navigation: NavigationWithFrameControl;
  readonly buildings: BuildingLayers;
  readonly loader: BuildingLoader;
  draw: DrawHandle | null;
  framing: FramingState;
  reframe: ReframeState;
}

interface LoadState {
  readonly mapLoaded: boolean;
  readonly buildings: LoadProgress;
}

const INITIAL_LOAD_STATE: LoadState = {
  mapLoaded: false,
  buildings: { total: BUILDING_PARTS.length, loaded: 0, failed: 0, settled: false, lastError: null },
};

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/** Runs `task` when the browser is idle, or after `timeoutMs` at the latest. */
function whenIdle(task: () => void, timeoutMs: number): void {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(task, { timeout: timeoutMs });
  else window.setTimeout(task, 0);
}

/** Overlay rectangles relative to the map container. */
function overlayRects(container: HTMLElement): ScreenRect[] {
  const box = container.getBoundingClientRect();
  return [...document.querySelectorAll<HTMLElement>(MAP_OVERLAY_SELECTOR)].map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left - box.left, top: rect.top - box.top, right: rect.right - box.left, bottom: rect.bottom - box.top };
  });
}

/** The parts whose buildings `chooseView` reads for this plot have all arrived (or failed). */
function surroundingsSettled(parts: MapParts, plot: readonly LngLat[]): boolean {
  return parts.loader.isSettled(partsAround(BUILDING_PARTS, plot, OCCLUDER_RANGE_M));
}

/**
 * Moves the camera so the plot fills about a third of the map left clear by the overlays, from
 * the view where surrounding buildings hide least of it (see `chooseView`; ties go to the road
 * side). With no buildings loaded yet it simply looks in from the widest road; when the
 * buildings around the plot are still loading, it is framed again once they arrive (see
 * `maybeReframe`).
 */
function framePlot(parts: MapParts): void {
  const { map } = parts;
  const { plot, edges } = useAppStore.getState();
  if (!plot || plot.length < 3) return;
  const container = map.getContainer();
  const width = container.clientWidth;
  const height = container.clientHeight;
  // Hidden on-plot buildings must already be excluded, so bring the filter up to date first.
  parts.buildings.hideInside(plot);
  const context = parts.buildings.context();
  const { bearing, pitch } = context
    ? chooseView({ plot, edges, ...context, currentBearing: map.getBearing() })
    : { bearing: roadSideBearing(plot, edges) ?? map.getBearing(), pitch: FRAME_PITCH_DEGREES };
  parts.reframe = {
    pendingPlotKey: surroundingsSettled(parts, plot) ? null : plotKey(plot),
    userMoved: false,
  };
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

/** Frames once more when the buildings around a plot framed too early have arrived. */
function maybeReframe(parts: MapParts): void {
  const { plot } = useAppStore.getState();
  const decision = shouldReframe({
    pendingPlotKey: parts.reframe.pendingPlotKey,
    currentPlotKey: plot ? plotKey(plot) : null,
    userMoved: parts.reframe.userMoved,
    surroundingsSettled: plot ? surroundingsSettled(parts, plot) : false,
  });
  if (decision) framePlot(parts);
}

function applyFraming(parts: MapParts, event: FramingEvent): void {
  const step = framingStep(parts.framing, event);
  parts.framing = step.state;
  if (step.frame) framePlot(parts);
}

/**
 * Where to load buildings first: the plot, including one in the link that the URL sync has not
 * put in the store yet (the map is created before it runs), else the camera centre.
 */
function loadFocus(map: MapLibreMap): LngLat {
  const plot = useAppStore.getState().plot ?? decodeScenario(window.location.hash)?.plot ?? null;
  const centre = plot ? plotCentroid(plot) : null;
  if (centre) return centre;
  const { lng, lat } = map.getCenter();
  return [lng, lat];
}

export function MapView({ model, onDataError }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<MapParts | null>(null);
  const markersRef = useRef<readonly EdgeMarker[]>([]);
  const onDataErrorRef = useRef(onDataError);
  onDataErrorRef.current = onDataError;
  const [loadState, setLoadState] = useState<LoadState>(INITIAL_LOAD_STATE);

  const plot = useAppStore((state) => state.plot);
  const edges = useAppStore((state) => state.edges);
  const selectedEdge = useAppStore((state) => state.selectedEdge);
  const plotRevision = useAppStore((state) => state.plotRevision);

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let isRemoved = false;
    // Requested now, so terra-draw downloads while the basemap style loads.
    const drawModule = import('./drawSetup');

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
    const navigation = new NavigationWithFrameControl(new NavigationControl({ visualizePitch: true }), () => {
      if (partsRef.current) framePlot(partsRef.current);
    });
    navigation.setEnabled(useAppStore.getState().plot !== null);
    map.addControl(navigation, 'bottom-left');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    const modelLayer = new ModelLayer((error) => {
      if (!isRemoved) onDataErrorRef.current(`The 3D model could not be loaded (${errorMessage(error)}). Reload to try again.`);
    });
    const buildings = new BuildingLayers();
    let hasReportedBuildingError = false;
    const loader = createBuildingLoader({
      parts: BUILDING_PARTS,
      fetchPart: fetchBuildingPart,
      focus: () => loadFocus(map),
      onPart: (part, collection) => buildings.addPart(part.index, collection),
      onProgress: (progress) => {
        if (isRemoved) return;
        setLoadState((state) => ({ ...state, buildings: progress }));
        if (progress.settled && progress.failed > 0) {
          hasReportedBuildingError = true;
          onDataErrorRef.current(
            `Surrounding buildings could not be loaded for ${progress.failed} of ${progress.total} areas (${progress.lastError ?? 'unknown error'}). Use "Try again" on the map.`,
          );
        } else if (hasReportedBuildingError && progress.failed === 0) {
          hasReportedBuildingError = false;
          onDataErrorRef.current(null);
        }
        maybeReframe(parts);
      },
    });

    const parts: MapParts = {
      map,
      modelLayer,
      navigation,
      buildings,
      loader,
      draw: null,
      framing: INITIAL_FRAMING,
      reframe: { pendingPlotKey: null, userMoved: false },
    };
    partsRef.current = parts;
    const removeDebugHandle = exposeDebugHandle(window, window.location.search, map);

    // Building data never waits for the map: parts are fetched now and added when the style is ready.
    loader.start();

    // Only user gestures carry an original event; the app's own easeTo does not.
    map.on('movestart', (event) => {
      if (event.originalEvent) parts.reframe = { ...parts.reframe, userMoved: true };
    });

    map.once('load', () => {
      if (isRemoved) return;
      setLoadState((state) => ({ ...state, mapLoaded: true }));
      collapseAttributionOnSmallScreens(map);
      whenIdle(() => {
        if (!isRemoved) modelLayer.preload();
      }, MODEL_PRELOAD_TIMEOUT_MS);
    });

    map.once('style.load', () => {
      map.addLayer(modelLayer);
      buildings.attach(map);
      buildings.hideInside(useAppStore.getState().plot);

      loadSiteData()
        .then((data) => {
          if (!isRemoved) addZoneAndStationLayers(map, data);
        })
        .catch(() => {
          // The panel already reports a missing zone map (useEvaluation shares this request).
        });

      drawModule
        .then(({ startDraw }) => {
          if (isRemoved) return;
          parts.draw = startDraw(map, () =>
            applyFraming(parts, { type: 'drawn', hasRoad: hasRoad(useAppStore.getState().edges) }),
          );
        })
        .catch((error: unknown) => {
          if (!isRemoved) onDataErrorRef.current(`The drawing tools could not be loaded (${errorMessage(error)}). Reload to try again.`);
        });
    });

    return () => {
      isRemoved = true;
      loader.stop();
      removeDebugHandle();
      parts.draw?.stop();
      map.remove();
      partsRef.current = null;
    };
  }, []);

  const retryBuildings = useCallback(() => partsRef.current?.loader.retry(), []);

  // Redraw the outline when the plot is replaced from outside the map (a preset, or "start over"),
  // and frame a newly loaded preset. Declared before the edge effect, which must see this first.
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts) return;
    parts.draw?.sync();
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
    partsRef.current?.buildings.hideInside(plot);
  }, [plot]);

  useEffect(() => {
    partsRef.current?.modelLayer.setContent(model);
  }, [model]);

  const statusMessage = mapStatusMessage({
    mapLoaded: loadState.mapLoaded,
    buildings: loadState.buildings,
    plotOutsideStudyArea: plot !== null && !isInsideStudyArea(plot),
    outsideNote: OUTSIDE_STUDY_AREA_NOTE,
  });

  return (
    <>
      <div ref={containerRef} className="map-root" data-testid="map" role="application" aria-label="Map of the site. Click to place the corners of the plot. No mouse? Choose an example plot, open a shared link, or enter the corner coordinates in the panel." />
      <MapStatus message={statusMessage} onRetry={retryBuildings} />
    </>
  );
}

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';

/** BTS Punnawithi, inside the zone ย.7 study area. [lng, lat] */
const STUDY_AREA_CENTER: [number, number] = [100.609, 13.6893];
const INITIAL_ZOOM = 16.2;
const INITIAL_PITCH = 50;
const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

// MapLibre 6 ships its worker as a separate ES module. Vite must bundle it and hand us the URL.
setWorkerUrl(maplibreWorkerUrl);

type Ring = [number, number][];

interface MapViewProps {
  onPlotChange: (ring: Ring | null) => void;
}

export function MapView({ onPlotChange }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onPlotChangeRef = useRef(onPlotChange);
  onPlotChangeRef.current = onPlotChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MapLibreMap({
      container,
      style: BASEMAP_STYLE_URL,
      center: STUDY_AREA_CENTER,
      zoom: INITIAL_ZOOM,
      pitch: INITIAL_PITCH,
      maxPitch: 75,
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right');

    let draw: TerraDraw | null = null;

    map.once('style.load', () => {
      draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawPolygonMode(),
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  coordinates: { midpoints: true, draggable: true, deletable: true },
                },
              },
            },
          }),
        ],
      });
      draw.start();
      draw.setMode('polygon');

      const publishPlot = () => {
        if (!draw) return;
        const polygon = draw.getSnapshot().find((feature) => feature.geometry.type === 'Polygon');
        const ring = polygon?.geometry.type === 'Polygon' ? (polygon.geometry.coordinates[0] as Ring) : null;
        onPlotChangeRef.current(ring && ring.length >= 4 ? ring : null);
      };

      draw.on('finish', (id) => {
        publishPlot();
        draw?.setMode('select');
        draw?.selectFeature(id);
      });
      draw.on('change', publishPlot);
    });

    // Exposed for end-to-end tests only.
    (window as unknown as { __map?: MapLibreMap }).__map = map;

    return () => {
      draw?.stop();
      map.remove();
    };
  }, []);

  return <div ref={containerRef} className="map-root" data-testid="map" />;
}

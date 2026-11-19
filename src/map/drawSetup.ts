/**
 * Starts the drawing tool on the map. Loaded with a dynamic import as the map is created, so
 * terra-draw downloads alongside the basemap style instead of in the first bundle. MapView must
 * import nothing else from drawSync.ts, or terra-draw would be pulled back into the entry chunk.
 */
import type { Map as MapLibreMap } from 'maplibre-gl';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { createDraw, linkDraw, writeStoreToDraw } from './drawSync';

export interface DrawHandle {
  /** Redraws the outline from the store (after a preset or "start over"). */
  sync(): void;
  stop(): void;
}

export function startDraw(map: MapLibreMap, onDrawn: () => void): DrawHandle {
  const draw = createDraw(new TerraDrawMapLibreGLAdapter({ map }));
  draw.start();
  const link = linkDraw(draw, onDrawn);
  writeStoreToDraw(link);
  return {
    sync: () => writeStoreToDraw(link),
    stop: () => draw.stop(),
  };
}

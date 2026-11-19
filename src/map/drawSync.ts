/**
 * The link between terra-draw (the drawn outline) and the store (the plot). Kept apart from the
 * map so it can run against a real TerraDraw with a test adapter.
 *
 * Writes go both ways: the user edits the outline (draw -> store), and presets or "start over"
 * replace the plot (store -> draw). While the store's plot is being written into the drawing
 * tool, terra-draw emits change events for the old outline being deselected and deleted and the
 * new one being added. Those must never flow back into the store: publishing the old outline's
 * ring would replace the preset's plot, and `remapEdges` would reset its edge settings.
 */
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw';

/** What the TerraDraw constructor takes as its adapter (the type itself is not exported). */
export type DrawAdapter = ConstructorParameters<typeof TerraDraw>[0]['adapter'];
import type { LngLat } from '../core/types';
import { useAppStore } from '../state/store';

const PLOT_OUTLINE = '#12303a';
const PLOT_FILL = '#12303a';
const HANDLE_FILL = '#ffffff';

export interface DrawLink {
  readonly draw: TerraDraw;
  /** True while the store's plot is being written into the drawing tool. */
  isWritingToDraw: boolean;
}

export function createDraw(adapter: DrawAdapter): TerraDraw {
  return new TerraDraw({
    adapter,
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

function toOpenRing(closedRing: readonly (readonly number[])[]): LngLat[] {
  return closedRing.slice(0, -1).map((position) => [position[0] ?? 0, position[1] ?? 0] as const);
}

/** Sends the finished outline in the drawing tool to the store (draw -> store). */
export function publishPlot(link: DrawLink): void {
  if (link.isWritingToDraw) return;
  const finished = link.draw
    .getSnapshot()
    .find((feature) => feature.geometry.type === 'Polygon' && feature.properties.currentlyDrawing !== true);
  if (!finished || finished.geometry.type !== 'Polygon') return;
  const ring = finished.geometry.coordinates[0];
  if (ring && ring.length >= 4) useAppStore.getState().setPlotFromMap(toOpenRing(ring));
}

/** Makes the drawing tool show exactly the plot held in the store (store -> draw). */
export function writeStoreToDraw(link: DrawLink): void {
  const { draw } = link;
  const { plot } = useAppStore.getState();
  link.isWritingToDraw = true;
  try {
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
  } finally {
    link.isWritingToDraw = false;
  }
}

/**
 * Wires user edits to the store. `onDrawn` runs when a newly drawn outline is closed (not after
 * corner drags or inserted corners, which also emit 'finish').
 */
export function linkDraw(draw: TerraDraw, onDrawn: () => void): DrawLink {
  const link: DrawLink = { draw, isWritingToDraw: false };
  draw.on('finish', (id, context) => {
    if (link.isWritingToDraw) return;
    publishPlot(link);
    draw.setMode('select');
    draw.selectFeature(id);
    if (context.action === 'draw') onDrawn();
  });
  draw.on('change', (_ids, type) => {
    if (type !== 'delete') publishPlot(link);
  });
  return link;
}

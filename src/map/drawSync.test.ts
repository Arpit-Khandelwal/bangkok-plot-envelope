// @vitest-environment jsdom
/**
 * Runs the real TerraDraw against a minimal adapter, through the same store path the map uses:
 * loadPreset -> writeStoreToDraw, and user edits -> publishPlot -> setPlotFromMap.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TerraDrawExtend } from 'terra-draw';
import type { EdgeSpec, LngLat } from '../core/types';
import { PRESETS } from '../state/presets';
import { useAppStore } from '../state/store';
import { resetStore } from '../ui/testing/storeReset';
import { createDraw, linkDraw, publishPlot, writeStoreToDraw, type DrawAdapter, type DrawLink } from './drawSync';

/** A flat projection: 1 degree = 100,000 px. Enough for the store, no map needed. */
class TestAdapter extends TerraDrawExtend.TerraDrawBaseAdapter {
  private readonly element = document.createElement('div');

  constructor() {
    super({ coordinatePrecision: 9 });
  }

  getMapEventElement(): HTMLElement {
    return this.element;
  }
  /** As the MapLibre adapter does: the mode's onClear empties the store. */
  clear(): void {
    this._currentModeCallbacks?.onClear();
  }
  project(lng: number, lat: number): { x: number; y: number } {
    return { x: lng * 100_000, y: -lat * 100_000 };
  }
  unproject(x: number, y: number): { lng: number; lat: number } {
    return { lng: x / 100_000, lat: -y / 100_000 };
  }
  setCursor(): void {}
  getLngLatFromEvent(): { lng: number; lat: number } | null {
    return null;
  }
  setDraggability(): void {}
  setDoubleClickToZoom(): void {}
  render(): void {}

  /** Moves the pointer to a corner and clicks, as a user drawing the outline would. */
  clickAt(point: LngLat): void {
    const { x, y } = this.project(point[0], point[1]);
    const event = { lng: point[0], lat: point[1], containerX: x, containerY: y, heldKeys: [], isContextMenu: false };
    this._currentModeCallbacks?.onMouseMove({ ...event, button: 'neither' });
    this._currentModeCallbacks?.onClick({ ...event, button: 'left' });
  }
}

function roadIndexes(edges: readonly EdgeSpec[]): number[] {
  return edges.flatMap((spec, index) => (spec.kind === 'road' ? [index] : []));
}

/** Each road edge as its two physical corners, so a re-ordered ring can be compared. */
function roadSegments(plot: readonly LngLat[], edges: readonly EdgeSpec[]): string[] {
  return roadIndexes(edges)
    .map((index) => {
      const a = plot[index];
      const b = plot[(index + 1) % plot.length];
      return [a, b]
        .map((point) => `${point?.[0].toFixed(6)},${point?.[1].toFixed(6)}`)
        .sort()
        .join(' ');
    })
    .sort();
}

let link: DrawLink;
let adapter: TestAdapter;
let drawnCount = 0;

beforeEach(() => {
  resetStore();
  drawnCount = 0;
  adapter = new TestAdapter();
  const draw = createDraw(adapter as DrawAdapter);
  draw.start();
  link = linkDraw(draw, () => {
    drawnCount += 1;
  });
  writeStoreToDraw(link);
});

afterEach(() => {
  link.draw.stop();
});

function loadThroughMap(presetIndex: number): void {
  const preset = PRESETS[presetIndex];
  if (!preset) throw new Error(`no preset ${presetIndex}`);
  useAppStore.getState().loadPreset(preset);
  writeStoreToDraw(link);
}

describe('preset loads through the drawing tool', () => {
  it.each(PRESETS.map((preset, index) => [preset.id, index] as const))(
    '%s keeps its road edges, on the same physical edges',
    (_id, index) => {
      loadThroughMap(index);
      const preset = PRESETS[index];
      const { plot, edges } = useAppStore.getState();
      expect(plot).not.toBeNull();
      expect(edges).toHaveLength(preset?.plot.length ?? 0);
      expect(roadSegments(plot ?? [], edges)).toEqual(roadSegments(preset?.plot ?? [], preset?.edges ?? []));
    },
  );

  it('keeps each preset intact when loaded after other presets', () => {
    const order = [2, 5, 0, 2, 6, 5, 3, 2];
    order.forEach((index) => {
      loadThroughMap(index);
      const preset = PRESETS[index];
      const { plot, edges } = useAppStore.getState();
      expect(plot).toEqual(preset?.plot);
      expect(edges).toEqual(preset?.edges);
    });
  });

  it('publishes a user edit after a preset load, carrying the road to the same physical edge', () => {
    loadThroughMap(2);
    publishPlot(link);
    const preset = PRESETS[2];
    const { plot, edges } = useAppStore.getState();
    expect(roadSegments(plot ?? [], edges)).toEqual(roadSegments(preset?.plot ?? [], preset?.edges ?? []));
  });
});

describe('a hand-drawn outline', () => {
  // About 50 m square, clicked clockwise: SW, NW, NE, SE.
  const SW: LngLat = [100.60877, 13.68907];
  const NW: LngLat = [100.60877, 13.68953];
  const NE: LngLat = [100.60923, 13.68953];
  const SE: LngLat = [100.60923, 13.68907];

  function openRingOfDrawing(): LngLat[] {
    const feature = link.draw.getSnapshot().find((candidate) => candidate.geometry.type === 'Polygon');
    if (feature?.geometry.type !== 'Polygon') return [];
    return (feature.geometry.coordinates[0] ?? []).slice(0, -1).map((p): LngLat => [p[0] ?? 0, p[1] ?? 0]);
  }

  it('is stored exactly as the drawing tool shows it, so edge letters match the outline', () => {
    [SW, NW, NE, SE, SW].forEach((corner) => adapter.clickAt(corner));

    const { plot, edges } = useAppStore.getState();
    expect(drawnCount).toBe(1);
    // terra-draw turned the clockwise clicks counter-clockwise when the outline closed.
    expect(plot).toEqual([SW, SE, NE, NW]);
    expect(openRingOfDrawing()).toEqual(plot);
    expect(edges).toHaveLength(4);
  });

  it('keeps a road marked after drawing on the same physical edge through a reload of the outline', () => {
    [SW, NW, NE, SE, SW].forEach((corner) => adapter.clickAt(corner));
    const before = useAppStore.getState();
    // Mark the south edge (SW to SE) as a road.
    const same = (a: LngLat | undefined, b: LngLat): boolean => a?.[0] === b[0] && a[1] === b[1];
    const southIndex = (before.plot ?? []).findIndex((corner, i, ring) => same(corner, SW) && same(ring[(i + 1) % ring.length], SE));
    expect(southIndex).toBeGreaterThanOrEqual(0);
    useAppStore.getState().setEdge(southIndex, { kind: 'road', roadId: 'soi', rowWidthM: 8 });

    publishPlot(link);

    const { plot, edges } = useAppStore.getState();
    expect(roadSegments(plot ?? [], edges)).toEqual(roadSegments([SW, SE, NE, NW], [{ kind: 'road', roadId: 'soi', rowWidthM: 8 }, ...Array.from({ length: 3 }, (): EdgeSpec => ({ kind: 'neighbour' }))]));
  });
});


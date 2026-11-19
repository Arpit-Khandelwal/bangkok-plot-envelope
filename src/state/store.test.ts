import { beforeEach, describe, expect, it } from 'vitest';
import type { EdgeSpec } from '../core/types';
import { resetStore, SAMPLE_PLOT } from '../ui/testing/storeReset';
import { useAppStore } from './store';

beforeEach(() => resetStore());

describe('clearPlot', () => {
  it('resets the switched-off rules so the notice does not survive Start over', () => {
    // Arrange
    resetStore({ plot: SAMPLE_PLOT, disabledRuleIds: ['far', 'osr'] });

    // Act
    useAppStore.getState().clearPlot();

    // Assert
    expect(useAppStore.getState().disabledRuleIds).toEqual([]);
    expect(useAppStore.getState().plot).toBeNull();
  });
});

describe('setRoadWidth', () => {
  it('updates every edge on the road and leaves other edges alone', () => {
    // Arrange
    const edges: readonly EdgeSpec[] = [
      { kind: 'road', roadId: 'road-1', rowWidthM: 8 },
      { kind: 'neighbour' },
      { kind: 'road', roadId: 'road-1', rowWidthM: 8 },
      { kind: 'road', roadId: 'road-2', rowWidthM: 30 },
    ];
    resetStore({ plot: SAMPLE_PLOT, edges });

    // Act
    useAppStore.getState().setRoadWidth('road-1', 12);

    // Assert
    expect(useAppStore.getState().edges).toEqual([
      { kind: 'road', roadId: 'road-1', rowWidthM: 12 },
      { kind: 'neighbour' },
      { kind: 'road', roadId: 'road-1', rowWidthM: 12 },
      { kind: 'road', roadId: 'road-2', rowWidthM: 30 },
    ]);
  });
});

describe('setPlotFromMap', () => {
  it('keeps a road on the same physical edge when the map hands back the ring reversed', () => {
    // Arrange: SAMPLE_PLOT runs SW, SE, NE, NW, so edge 0 is the south edge.
    const road: EdgeSpec = { kind: 'road', roadId: 'road-1', rowWidthM: 12 };
    resetStore({ plot: SAMPLE_PLOT, edges: [road, { kind: 'neighbour' }, { kind: 'neighbour' }, { kind: 'neighbour' }] });
    const [sw, se, ne, nw] = SAMPLE_PLOT;
    if (!sw || !se || !ne || !nw) throw new Error('sample plot needs four corners');

    // Act: the same square walked clockwise from the same corner.
    useAppStore.getState().setPlotFromMap([sw, nw, ne, se]);

    // Assert: the south edge is now the last edge, from SE back to SW.
    expect(useAppStore.getState().edges).toEqual([
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      road,
    ]);
  });
});

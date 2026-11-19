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

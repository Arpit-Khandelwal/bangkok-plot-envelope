import type { EdgeSpec, LngLat } from '../../core/types';
import { useAppStore } from '../../state/store';

const INITIAL_STATE = useAppStore.getState();

/** Square plot of roughly 50 x 50 m near BTS Punnawithi, matching the sample evaluation. */
export const SAMPLE_PLOT: readonly LngLat[] = [
  [100.60877, 13.68907],
  [100.60923, 13.68907],
  [100.60923, 13.68953],
  [100.60877, 13.68953],
];

export const SAMPLE_EDGES: readonly EdgeSpec[] = [
  { kind: 'road', roadId: 'road-1', rowWidthM: 12 },
  { kind: 'neighbour' },
  { kind: 'neighbour' },
  { kind: 'neighbour' },
];

export function resetStore(overrides: Partial<ReturnType<typeof useAppStore.getState>> = {}): void {
  useAppStore.setState({ ...INITIAL_STATE, ...overrides }, true);
}

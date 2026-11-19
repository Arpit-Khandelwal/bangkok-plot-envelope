import { describe, expect, it } from 'vitest';
import type { LngLat } from '../core/types';
import type { BuildingCollection, BuildingPart } from '../site/buildingParts';
import { createBuildingLoader, type LoadProgress } from './buildingLoader';

/** Five parts in a row along longitude, each 0.01 degrees wide. */
const PARTS: readonly BuildingPart[] = [0, 1, 2, 3, 4].map((index) => ({
  index,
  url: `/p${index}`,
  bbox: [100 + index * 0.01, 13, 100.01 + index * 0.01, 13.01],
  count: 0,
}));

const EMPTY: BuildingCollection = { type: 'FeatureCollection', features: [] };

interface Pending {
  readonly part: BuildingPart;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

function harness(focus: () => LngLat = () => [100.005, 13.005]) {
  const pending: Pending[] = [];
  const requested: number[] = [];
  const added: number[] = [];
  const progress: LoadProgress[] = [];
  const loader = createBuildingLoader({
    parts: PARTS,
    concurrency: 2,
    focus,
    fetchPart: (part) =>
      new Promise<BuildingCollection>((resolve, reject) => {
        requested.push(part.index);
        pending.push({ part, resolve: () => resolve(EMPTY), reject });
      }),
    onPart: (part) => added.push(part.index),
    onProgress: (update) => progress.push(update),
  });
  const settle = async (index: number, error?: Error): Promise<void> => {
    const position = pending.findIndex((entry) => entry.part.index === index);
    const [entry] = pending.splice(position, 1);
    if (!entry) throw new Error(`part ${index} is not in flight`);
    if (error) entry.reject(error);
    else entry.resolve();
    // Let the promise chain (then, catch, finally) run.
    for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
  };
  const last = (): LoadProgress | undefined => progress[progress.length - 1];
  return { loader, requested, added, settle, last };
}

describe('createBuildingLoader', () => {
  it('requests the nearest parts first, never more than the concurrency at once', async () => {
    const { loader, requested, settle } = harness();
    loader.start();
    expect(requested).toEqual([0, 1]);
    await settle(0);
    expect(requested).toEqual([0, 1, 2]);
    await settle(1);
    await settle(2);
    expect(requested).toEqual([0, 1, 2, 3, 4]);
  });

  it('chooses each next part from the focus at that moment', async () => {
    let focus: LngLat = [100.005, 13.005];
    const { loader, requested, settle } = harness(() => focus);
    loader.start();
    // A plot arrives at the far end before the first slot frees up.
    focus = [100.045, 13.005];
    await settle(0);
    expect(requested).toEqual([0, 1, 4]);
  });

  it('keeps the parts that loaded when one fails, and reports it', async () => {
    const { loader, added, settle, last } = harness();
    loader.start();
    await settle(0);
    await settle(1, new Error('/p1 returned 503'));
    await settle(2);
    await settle(3);
    await settle(4);
    expect(added).toEqual([0, 2, 3, 4]);
    expect(last()).toEqual({ total: 5, loaded: 4, failed: 1, settled: true, lastError: '/p1 returned 503' });
    expect(loader.isSettled([0, 1])).toBe(true);
  });

  it('loads only the failed parts again on retry', async () => {
    const { loader, requested, added, settle, last } = harness();
    loader.start();
    await settle(0, new Error('offline'));
    await settle(1);
    await settle(2);
    await settle(3);
    await settle(4);
    requested.length = 0;
    loader.retry();
    expect(requested).toEqual([0]);
    expect(last()?.settled).toBe(false);
    await settle(0);
    expect(added).toEqual([1, 2, 3, 4, 0]);
    expect(last()).toEqual({ total: 5, loaded: 5, failed: 0, settled: true, lastError: null });
  });

  it('tells whether given parts have settled', async () => {
    const { loader, settle } = harness();
    loader.start();
    expect(loader.isSettled([0])).toBe(false);
    await settle(0);
    expect(loader.isSettled([0])).toBe(true);
    expect(loader.isSettled([0, 1])).toBe(false);
  });

  it('ignores results after stop', async () => {
    const { loader, added, settle } = harness();
    loader.start();
    loader.stop();
    await settle(0);
    expect(added).toEqual([]);
  });
});

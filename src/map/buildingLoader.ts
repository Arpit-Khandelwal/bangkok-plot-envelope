/**
 * Streams the building parts nearest-first with a few requests in flight. The next part is
 * chosen only when a slot frees up, so a plot restored from the link after loading began still
 * gets its surroundings first. A failed part is kept as failed; the parts that loaded stay.
 */
import type { LngLat } from '../core/types';
import type { BuildingCollection, BuildingPart } from '../site/buildingParts';
import { nextPart } from './partOrder';

/**
 * HTTP/2 lifts the six-per-host limit but not the shared bandwidth: with every part in flight,
 * the nearest would finish as late as the rest. Three keeps the pipe full and the first part quick.
 */
export const PART_CONCURRENCY = 3;

export type PartState = 'waiting' | 'loading' | 'loaded' | 'failed';

export interface LoadProgress {
  readonly total: number;
  readonly loaded: number;
  readonly failed: number;
  /** No part is waiting or loading. */
  readonly settled: boolean;
  /** Message of the last failure, for the panel notice. */
  readonly lastError: string | null;
}

export interface BuildingLoaderOptions {
  readonly parts: readonly BuildingPart[];
  readonly fetchPart: (part: BuildingPart, signal: AbortSignal) => Promise<BuildingCollection>;
  /** Where to load around: the plot, else the camera centre. Read each time a slot frees up. */
  readonly focus: () => LngLat;
  readonly onPart: (part: BuildingPart, collection: BuildingCollection) => void;
  /** Called after every change of a part's state. */
  readonly onProgress: (progress: LoadProgress) => void;
  readonly concurrency?: number;
}

export interface BuildingLoader {
  start(): void;
  /** Loads the failed parts again. */
  retry(): void;
  stop(): void;
  progress(): LoadProgress;
  /** Whether every listed part has loaded or failed. */
  isSettled(indexes: readonly number[]): boolean;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

export function createBuildingLoader(options: BuildingLoaderOptions): BuildingLoader {
  const concurrency = options.concurrency ?? PART_CONCURRENCY;
  const controller = new AbortController();
  let states: ReadonlyMap<number, PartState> = new Map(options.parts.map((part) => [part.index, 'waiting']));
  let lastError: string | null = null;
  let isStopped = false;

  const setState = (index: number, state: PartState): void => {
    states = new Map([...states, [index, state]]);
  };

  const progress = (): LoadProgress => {
    const values = [...states.values()];
    const count = (state: PartState): number => values.filter((value) => value === state).length;
    const loaded = count('loaded');
    const failed = count('failed');
    return { total: values.length, loaded, failed, settled: loaded + failed === values.length, lastError };
  };

  const report = (): void => {
    if (!isStopped) options.onProgress(progress());
  };

  const pump = (): void => {
    if (isStopped) return;
    const inFlight = [...states.values()].filter((state) => state === 'loading').length;
    if (inFlight >= concurrency) return;
    const waiting = options.parts.filter((part) => states.get(part.index) === 'waiting');
    const part = nextPart(waiting, options.focus());
    if (!part) return;
    setState(part.index, 'loading');
    options
      .fetchPart(part, controller.signal)
      .then((collection) => {
        if (isStopped) return;
        setState(part.index, 'loaded');
        options.onPart(part, collection);
      })
      .catch((error: unknown) => {
        if (isStopped) return;
        setState(part.index, 'failed');
        lastError = errorMessage(error);
      })
      .finally(() => {
        report();
        pump();
      });
    // Fill the remaining slots.
    pump();
  };

  return {
    start(): void {
      report();
      pump();
    },
    retry(): void {
      if (isStopped) return;
      const failed = [...states].filter(([, state]) => state === 'failed').map(([index]) => index);
      if (failed.length === 0) return;
      failed.forEach((index) => setState(index, 'waiting'));
      lastError = null;
      report();
      pump();
    },
    stop(): void {
      isStopped = true;
      controller.abort();
    },
    progress,
    isSettled(indexes: readonly number[]): boolean {
      return indexes.every((index) => {
        const state = states.get(index);
        return state === 'loaded' || state === 'failed';
      });
    },
  };
}

import { useEffect } from 'react';
import { useAppStore } from './store';
import type { AppState } from './store';
import { decodeScenario, encodeScenario } from './urlState';
import type { ScenarioFields } from './urlState';

export const URL_WRITE_DEBOUNCE_MS = 300;

type Store = typeof useAppStore;

/** The scenario part of the state, or null when no plot is drawn. */
export function scenarioOf(state: AppState): ScenarioFields | null {
  return state.plot
    ? {
        plot: state.plot,
        edges: state.edges,
        buildingType: state.buildingType,
        assumptions: state.assumptions,
        interpretation: state.interpretation,
        disabledRuleIds: state.disabledRuleIds,
        selectedDesignId: state.selectedDesignId,
      }
    : null;
}

function isSameScenario(a: AppState, b: AppState): boolean {
  return (
    a.plot === b.plot &&
    a.edges === b.edges &&
    a.buildingType === b.buildingType &&
    a.assumptions === b.assumptions &&
    a.interpretation === b.interpretation &&
    a.disabledRuleIds === b.disabledRuleIds &&
    a.selectedDesignId === b.selectedDesignId
  );
}

/** Writes the current scenario into the hash now (no history entry), or removes the hash without a plot. */
export function writeHashNow(store: Store = useAppStore): void {
  const scenario = scenarioOf(store.getState());
  const wanted = scenario ? `#${encodeScenario(scenario)}` : '';
  if (window.location.hash === wanted) return;
  const base = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(window.history.state, '', `${base}${wanted}`);
}

/**
 * Keeps the URL hash and the store in step. A valid hash at start, or pasted later, is loaded;
 * edits are written back after a short pause. Returns a function that stops it.
 */
export function startUrlSync(store: Store = useAppStore, debounceMs = URL_WRITE_DEBOUNCE_MS): () => void {
  let isLoading = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancelWrite = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const loadFromHash = (): void => {
    const decoded = decodeScenario(window.location.hash);
    if (!decoded) return;
    const current = scenarioOf(store.getState());
    if (current && encodeScenario(current) === encodeScenario(decoded)) return;
    cancelWrite();
    isLoading = true;
    try {
      store.getState().loadScenario(decoded);
    } finally {
      isLoading = false;
    }
  };

  loadFromHash();

  const unsubscribe = store.subscribe((state, previous) => {
    if (isLoading || isSameScenario(state, previous)) return;
    cancelWrite();
    timer = setTimeout(() => {
      timer = null;
      writeHashNow(store);
    }, debounceMs);
  });
  window.addEventListener('hashchange', loadFromHash);

  return () => {
    cancelWrite();
    unsubscribe();
    window.removeEventListener('hashchange', loadFromHash);
  };
}

/** Call once from the app root. */
export function useUrlSync(): void {
  useEffect(() => startUrlSync(), []);
}

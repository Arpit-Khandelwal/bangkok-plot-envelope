import type { Map as MapLibreMap } from 'maplibre-gl';

/** What `?debug` exposes for manual testing in the browser console. */
export interface DebugHandle {
  readonly map: MapLibreMap;
}

declare global {
  interface Window {
    __buildable?: DebugHandle;
  }
}

export interface DebugTarget {
  __buildable?: DebugHandle;
}

export function isDebugEnabled(search: string): boolean {
  return new URLSearchParams(search).has('debug');
}

/**
 * Sets `target.__buildable = { map }` only when the query string has `debug`. Returns a cleanup
 * that removes it again (a no-op when nothing was exposed).
 */
export function exposeDebugHandle(target: DebugTarget, search: string, map: MapLibreMap): () => void {
  if (!isDebugEnabled(search)) return () => undefined;
  const handle: DebugHandle = { map };
  target.__buildable = handle;
  return () => {
    if (target.__buildable === handle) delete target.__buildable;
  };
}

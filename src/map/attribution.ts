import type { Map as MapLibreMap } from 'maplibre-gl';

/** Below this the attribution, open, covers too much of the map. Matches the CSS breakpoint. */
const SMALL_SCREEN_QUERY = '(max-width: 899.98px)';
const COMPACT_OPEN_CLASS = 'maplibregl-compact-show';

/**
 * MapLibre's compact attribution starts open (`maplibregl-compact-show`) and closes itself on the
 * first drag. On small screens it is closed as soon as the map has loaded instead, exactly as
 * MapLibre's own first-drag handler does (it only removes the class). The control stays in place
 * and its "i" button still opens it: the attribution is a licence requirement.
 */
export function collapseAttribution(container: HTMLElement): void {
  container
    .querySelectorAll<HTMLElement>(`.maplibregl-ctrl-attrib.${COMPACT_OPEN_CLASS}`)
    .forEach((element) => element.classList.remove(COMPACT_OPEN_CLASS));
}

/** Collapses now and again on the first idle, in case the attribution text arrived late. */
export function collapseAttributionOnSmallScreens(map: MapLibreMap): void {
  if (typeof window.matchMedia !== 'function' || !window.matchMedia(SMALL_SCREEN_QUERY).matches) return;
  const container = map.getContainer();
  collapseAttribution(container);
  map.once('idle', () => collapseAttribution(container));
}

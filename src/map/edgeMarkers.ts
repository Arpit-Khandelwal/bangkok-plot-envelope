import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import type { EdgeSpec, LngLat } from '../core/types';
import { edgeLetter, edgeSummary } from './edgeLabels';

export interface EdgeMarker {
  readonly marker: Marker;
  readonly chip: HTMLButtonElement;
  readonly letter: HTMLSpanElement;
  readonly summary: HTMLSpanElement;
}

/** Identifies the plot's corner positions. Markers are rebuilt only when this changes. */
export function plotKey(plot: readonly LngLat[] | null): string {
  return plot ? plot.map((point) => `${point[0]},${point[1]}`).join(';') : '';
}

function midpoint(a: LngLat, b: LngLat): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * Sets class names, text and aria-label on an existing marker. Nothing is replaced, so a
 * keyboard user who just pressed Enter on a chip keeps focus.
 */
export function updateEdgeMarker(entry: EdgeMarker, index: number, spec: EdgeSpec, isSelected: boolean): void {
  const { chip, letter, summary } = entry;
  const className = `edge-chip edge-chip--${spec.kind}${isSelected ? ' edge-chip--selected' : ''}`;
  if (chip.className !== className) chip.className = className;
  const label = `Edge ${edgeLetter(index)}: ${edgeSummary(spec)}. Select to change.`;
  if (chip.getAttribute('aria-label') !== label) chip.setAttribute('aria-label', label);
  const letterText = edgeLetter(index);
  if (letter.textContent !== letterText) letter.textContent = letterText;
  const summaryText = edgeSummary(spec);
  if (summary.textContent !== summaryText) summary.textContent = summaryText;
}

function createEdgeMarker(map: MapLibreMap, start: LngLat, end: LngLat, onSelect: () => void): EdgeMarker {
  const chip = document.createElement('button');
  chip.type = 'button';
  const letter = document.createElement('span');
  letter.className = 'edge-chip__letter';
  const summary = document.createElement('span');
  summary.className = 'edge-chip__summary';
  chip.append(letter, summary);
  chip.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect();
  });
  const marker = new Marker({ element: chip, anchor: 'center' }).setLngLat(midpoint(start, end)).addTo(map);
  return { marker, chip, letter, summary };
}

/** One marker per plot edge, at the edge midpoint. Fill them in with `updateEdgeMarker`. */
export function createEdgeMarkers(
  map: MapLibreMap,
  plot: readonly LngLat[],
  onSelect: (index: number) => void,
): readonly EdgeMarker[] {
  return plot.map((start, index) =>
    createEdgeMarker(map, start, plot[(index + 1) % plot.length] ?? start, () => onSelect(index)),
  );
}

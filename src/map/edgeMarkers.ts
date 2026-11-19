import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import type { EdgeSpec, LngLat } from '../core/types';
import { edgeLetter, edgeSummary } from './edgeLabels';
import type { PixelOffset } from './markerOffset';

/**
 * One chip per plot edge.
 *
 * MapLibre owns `root`: its constructor adds `maplibregl-marker` and an anchor class, which give
 * the element `position: absolute`, and it writes an inline transform on every frame. Nothing
 * here ever assigns `root.className` or `root.style`. Our styling lives on `chip`, a child button,
 * and the only class we touch on `root` is our own, through `classList`.
 */
export interface EdgeMarker {
  readonly marker: Marker;
  readonly root: HTMLDivElement;
  readonly chip: HTMLButtonElement;
  readonly letter: HTMLSpanElement;
  readonly summary: HTMLSpanElement;
}

const KINDS: readonly EdgeSpec['kind'][] = ['neighbour', 'road', 'waterway'];

/** Identifies the plot's corner positions. Markers are rebuilt only when this changes. */
export function plotKey(plot: readonly LngLat[] | null): string {
  return plot ? plot.map((point) => `${point[0]},${point[1]}`).join(';') : '';
}

function midpoint(a: LngLat, b: LngLat): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function edgeMarkerLabel(index: number, spec: EdgeSpec): string {
  return `Edge ${edgeLetter(index)}: ${edgeSummary(spec)}. Select to change.`;
}

/**
 * Sets classes, text and aria-label on an existing marker. Nothing is replaced, so a keyboard
 * user who just pressed Enter on a chip keeps focus.
 */
export function updateEdgeMarker(entry: EdgeMarker, index: number, spec: EdgeSpec, isSelected: boolean): void {
  const { root, chip, letter, summary } = entry;
  KINDS.forEach((kind) => chip.classList.toggle(`edge-tag--${kind}`, kind === spec.kind));
  // Roads and canals keep their summary visible; a neighbour edge shows only its letter.
  chip.classList.toggle('edge-tag--labelled', spec.kind !== 'neighbour');
  chip.classList.toggle('edge-tag--selected', isSelected);
  const pressed = String(isSelected);
  if (chip.getAttribute('aria-pressed') !== pressed) chip.setAttribute('aria-pressed', pressed);
  root.classList.toggle('edge-marker--selected', isSelected);

  const label = edgeMarkerLabel(index, spec);
  if (chip.getAttribute('aria-label') !== label) chip.setAttribute('aria-label', label);
  const letterText = edgeLetter(index);
  if (letter.textContent !== letterText) letter.textContent = letterText;
  const summaryText = edgeSummary(spec);
  if (summary.textContent !== summaryText) summary.textContent = summaryText;
}

/** Builds the marker and its DOM without adding it to a map, so it can be tested on its own. */
export function createEdgeMarker(position: LngLat, onSelect: () => void): EdgeMarker {
  const root = document.createElement('div');
  root.classList.add('edge-marker');
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.classList.add('edge-tag');
  chip.setAttribute('aria-pressed', 'false');
  const letter = document.createElement('span');
  letter.classList.add('edge-tag__letter');
  letter.setAttribute('aria-hidden', 'true');
  const summary = document.createElement('span');
  summary.classList.add('edge-tag__summary');
  summary.setAttribute('aria-hidden', 'true');
  chip.append(letter, summary);
  root.append(chip);
  chip.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect();
  });
  const marker = new Marker({ element: root, anchor: 'center' }).setLngLat([position[0], position[1]]);
  return { marker, root, chip, letter, summary };
}

/**
 * Moves focus to an edge's controls in the panel: the checked kind radio, or the first one.
 * The marker says "Select to change", so activating it should land where the change is made.
 */
export function focusEdgeControl(index: number, root: ParentNode = document): void {
  const radios = root.querySelectorAll<HTMLInputElement>(`input[name="edge-kind-${index}"]`);
  const target = [...radios].find((radio) => radio.checked) ?? radios[0];
  target?.focus();
}

/** One marker per plot edge, at the edge midpoint. Fill them in with `updateEdgeMarker`. */
export function createEdgeMarkers(
  map: MapLibreMap,
  plot: readonly LngLat[],
  onSelect: (index: number) => void,
): readonly EdgeMarker[] {
  return plot.map((start, index) => {
    const end = plot[(index + 1) % plot.length] ?? start;
    const entry = createEdgeMarker(midpoint(start, end), () => {
      onSelect(index);
      focusEdgeControl(index);
    });
    entry.marker.addTo(map);
    return entry;
  });
}

/** Applies one screen offset per marker, skipping those that have not moved. */
export function setEdgeMarkerOffsets(markers: readonly EdgeMarker[], offsets: readonly PixelOffset[]): void {
  markers.forEach((entry, index) => {
    const offset = offsets[index];
    if (!offset) return;
    const current = entry.marker.getOffset();
    if (Math.abs(current.x - offset[0]) < 0.25 && Math.abs(current.y - offset[1]) < 0.25) return;
    entry.marker.setOffset([offset[0], offset[1]]);
  });
}

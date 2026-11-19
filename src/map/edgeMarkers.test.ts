// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createEdgeMarker, edgeMarkerLabel, plotKey, setEdgeMarkerOffsets, updateEdgeMarker } from './edgeMarkers';

const ROAD = { kind: 'road', roadId: 'r1', rowWidthM: 8 } as const;

describe('edge marker DOM', () => {
  it('keeps the classes MapLibre put on the marker root through in-place updates', () => {
    // Arrange
    const entry = createEdgeMarker([100.6, 13.7], () => undefined);
    const classesAfterCreation = [...entry.root.classList];

    // Act
    updateEdgeMarker(entry, 0, { kind: 'neighbour' }, false);
    updateEdgeMarker(entry, 0, ROAD, true);
    updateEdgeMarker(entry, 0, { kind: 'waterway', widthM: 12 }, false);

    // Assert
    expect(classesAfterCreation).toContain('maplibregl-marker');
    expect(classesAfterCreation).toContain('maplibregl-marker-anchor-center');
    classesAfterCreation.forEach((name) => expect(entry.root.classList.contains(name)).toBe(true));
    expect(entry.marker.getElement()).toBe(entry.root);
  });

  it('puts the chip inside a plain wrapper that MapLibre owns', () => {
    const entry = createEdgeMarker([100.6, 13.7], () => undefined);
    updateEdgeMarker(entry, 1, ROAD, false);

    expect(entry.root.tagName).toBe('DIV');
    expect(entry.root.children).toHaveLength(1);
    expect(entry.root.firstElementChild).toBe(entry.chip);
    expect(entry.chip.tagName).toBe('BUTTON');
    expect(entry.chip.classList.contains('maplibregl-marker')).toBe(false);
    expect([...entry.chip.children]).toEqual([entry.letter, entry.summary]);
  });

  it('toggles only its own modifier classes', () => {
    const entry = createEdgeMarker([100.6, 13.7], () => undefined);

    updateEdgeMarker(entry, 0, ROAD, true);
    expect(entry.chip.classList.contains('edge-tag--road')).toBe(true);
    expect(entry.chip.classList.contains('edge-tag--labelled')).toBe(true);
    expect(entry.chip.classList.contains('edge-tag--selected')).toBe(true);
    expect(entry.root.classList.contains('edge-marker--selected')).toBe(true);

    updateEdgeMarker(entry, 0, { kind: 'neighbour' }, false);
    expect(entry.chip.classList.contains('edge-tag--road')).toBe(false);
    expect(entry.chip.classList.contains('edge-tag--neighbour')).toBe(true);
    expect(entry.chip.classList.contains('edge-tag--labelled')).toBe(false);
    expect(entry.chip.classList.contains('edge-tag--selected')).toBe(false);
    expect(entry.root.classList.contains('edge-marker--selected')).toBe(false);
    expect(entry.chip.classList.contains('edge-tag')).toBe(true);
  });

  it('keeps the complete aria-label and the visible letter and summary', () => {
    const entry = createEdgeMarker([100.6, 13.7], () => undefined);
    updateEdgeMarker(entry, 2, ROAD, false);

    expect(entry.chip.getAttribute('aria-label')).toBe('Edge C: Road 8 m. Select to change.');
    expect(entry.chip.getAttribute('aria-label')).toBe(edgeMarkerLabel(2, ROAD));
    expect(entry.letter.textContent).toBe('C');
    expect(entry.summary.textContent).toBe('Road 8 m');
  });

  it('selects its edge on click', () => {
    const onSelect = vi.fn();
    const entry = createEdgeMarker([100.6, 13.7], onSelect);
    entry.chip.click();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('setEdgeMarkerOffsets', () => {
  it('applies one offset per marker', () => {
    const entries = [createEdgeMarker([100.6, 13.7], () => undefined), createEdgeMarker([100.61, 13.7], () => undefined)];
    setEdgeMarkerOffsets(entries, [
      [0, -18],
      [18, 0],
    ]);
    expect(entries[0]?.marker.getOffset().y).toBe(-18);
    expect(entries[1]?.marker.getOffset().x).toBe(18);
  });
});

describe('plotKey', () => {
  it('is empty without a plot and changes when a corner moves', () => {
    expect(plotKey(null)).toBe('');
    expect(plotKey([[1, 2], [3, 4]])).not.toBe(plotKey([[1, 2], [3, 5]]));
  });
});

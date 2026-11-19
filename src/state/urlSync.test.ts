// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore } from '../ui/testing/storeReset';
import { PRESETS } from './presets';
import { useAppStore } from './store';
import { startUrlSync, URL_WRITE_DEBOUNCE_MS } from './urlSync';
import { encodeScenario } from './urlState';
import { DEFAULT_ASSUMPTIONS, DEFAULT_INTERPRETATION } from './defaults';

const preset = PRESETS[0] as (typeof PRESETS)[number];
const encodedPreset = encodeScenario({
  plot: preset.plot,
  edges: preset.edges,
  buildingType: preset.buildingType,
  assumptions: DEFAULT_ASSUMPTIONS[preset.buildingType],
  interpretation: DEFAULT_INTERPRETATION,
  disabledRuleIds: [],
  selectedDesignId: null,
});

let stop: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  resetStore();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  stop?.();
  stop = null;
  vi.useRealTimers();
});

describe('startUrlSync', () => {
  it('loads a valid hash at start and bumps the plot revision', () => {
    window.history.replaceState(null, '', `/#${encodedPreset}`);
    const before = useAppStore.getState().plotRevision;
    stop = startUrlSync();
    const state = useAppStore.getState();
    expect(state.plot).toHaveLength(preset.plot.length);
    expect(state.plotRevision).toBe(before + 1);
    vi.advanceTimersByTime(URL_WRITE_DEBOUNCE_MS * 2);
    expect(window.location.hash).toBe(`#${encodedPreset}`);
  });

  it('ignores an invalid hash', () => {
    window.history.replaceState(null, '', '/#v2=garbage');
    stop = startUrlSync();
    expect(useAppStore.getState().plot).toBeNull();
  });

  it('writes the hash after a pause without adding history entries', () => {
    stop = startUrlSync();
    const length = window.history.length;
    useAppStore.getState().loadPreset(preset);
    useAppStore.getState().toggleRule('mr33.far-10');
    expect(window.location.hash).toBe('');
    vi.advanceTimersByTime(URL_WRITE_DEBOUNCE_MS);
    expect(window.location.hash.startsWith('#v2=')).toBe(true);
    expect(window.location.hash).toContain('mr33.far-10');
    expect(window.history.length).toBe(length);
  });

  it('removes the hash when the plot is cleared', () => {
    window.history.replaceState(null, '', `/#${encodedPreset}`);
    stop = startUrlSync();
    useAppStore.getState().clearPlot();
    vi.advanceTimersByTime(URL_WRITE_DEBOUNCE_MS);
    expect(window.location.hash).toBe('');
  });

  it('loads a link pasted into the same tab', () => {
    stop = startUrlSync();
    window.history.replaceState(null, '', `/#${encodedPreset}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(useAppStore.getState().plot).toHaveLength(preset.plot.length);
  });
});

import { describe, expect, it } from 'vitest';
import { mapStatusMessage, type MapLoadState } from './statusText';

const NOTE = 'Surrounding buildings are shown only around Bang Chak and Punnawithi.';

type Overrides = Omit<Partial<MapLoadState>, 'buildings'> & { readonly buildings?: Partial<MapLoadState['buildings']> };

function state(overrides: Overrides = {}): MapLoadState {
  return {
    mapLoaded: true,
    plotOutsideStudyArea: false,
    outsideNote: NOTE,
    ...overrides,
    buildings: { total: 11, loaded: 11, failed: 0, settled: true, ...overrides.buildings },
  };
}

describe('mapStatusMessage', () => {
  it('says the map is loading first', () => {
    expect(mapStatusMessage(state({ mapLoaded: false, buildings: { loaded: 2, settled: false } }))).toEqual({
      text: 'Loading map',
      kind: 'busy',
    });
  });

  it('counts the building areas as they arrive', () => {
    expect(mapStatusMessage(state({ buildings: { loaded: 3, settled: false } }))).toEqual({
      text: 'Loading surrounding buildings (3 of 11)',
      kind: 'busy',
    });
  });

  it('disappears once everything has loaded', () => {
    expect(mapStatusMessage(state())).toBeNull();
  });

  it('reports missing areas once loading has finished, offering to try again', () => {
    expect(mapStatusMessage(state({ buildings: { loaded: 9, failed: 2 } }))).toEqual({
      text: 'Some surrounding buildings could not be loaded (2 of 11 areas missing).',
      kind: 'error',
    });
    expect(mapStatusMessage(state({ buildings: { loaded: 0, failed: 11 } }))?.text).toBe(
      'Surrounding buildings could not be loaded.',
    );
  });

  it('keeps counting while a failed area waits for the others to finish', () => {
    expect(mapStatusMessage(state({ buildings: { loaded: 5, failed: 1, settled: false } }))?.kind).toBe('busy');
  });

  it('notes a plot outside the baked area once nothing is loading', () => {
    expect(mapStatusMessage(state({ plotOutsideStudyArea: true }))).toEqual({ text: NOTE, kind: 'note' });
    expect(mapStatusMessage(state({ plotOutsideStudyArea: true, buildings: { loaded: 4, settled: false } }))?.kind).toBe(
      'busy',
    );
  });
});

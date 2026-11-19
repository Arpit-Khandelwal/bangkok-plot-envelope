/** Non-conservative readings never carry over to another plot unnoticed (DECISIONS.md B15). */
import { beforeEach, describe, expect, it } from 'vitest';
import { evaluate } from '../core/evaluate';
import { nonDefaultReadings } from '../core/readings';
import { NEIGHBOUR, rect, road, scenario } from '../core/pipeline/test-scenarios';
import { expectOk } from '../core/pipeline/test-scenarios';
import { resetStore, SAMPLE_PLOT } from '../ui/testing/storeReset';
import { DEFAULT_ASSUMPTIONS, DEFAULT_INTERPRETATION } from './defaults';
import { PRESETS } from './presets';
import { useAppStore } from './store';

beforeEach(() => resetStore());

function loosen(): void {
  const s = useAppStore.getState();
  s.setInterpretation('parkingCountsInFar', false);
  s.setAssumption('efficiency', 0.95);
  s.toggleRule('plan.far');
}

describe('a new plot starts from the conservative readings', () => {
  it('clearPlot resets readings, assumptions and switched-off rules, and keeps the building type', () => {
    resetStore({ plot: SAMPLE_PLOT });
    useAppStore.getState().setBuildingType('office');
    loosen();
    useAppStore.getState().clearPlot();
    const s = useAppStore.getState();
    expect(s.interpretation).toEqual(DEFAULT_INTERPRETATION);
    expect(s.assumptions).toEqual(DEFAULT_ASSUMPTIONS.office);
    expect(s.disabledRuleIds).toEqual([]);
    expect(s.buildingType).toBe('office');
  });

  it('loadPreset resets readings, assumptions and switched-off rules', () => {
    resetStore({ plot: SAMPLE_PLOT });
    loosen();
    const preset = PRESETS[0];
    if (preset === undefined) throw new Error('no preset');
    useAppStore.getState().loadPreset(preset);
    const s = useAppStore.getState();
    expect(s.interpretation).toEqual(DEFAULT_INTERPRETATION);
    expect(s.assumptions).toEqual(DEFAULT_ASSUMPTIONS[preset.buildingType]);
    expect(s.disabledRuleIds).toEqual([]);
  });
});

describe('nonDefaultReadings', () => {
  it('is empty at the defaults', () => {
    expect(nonDefaultReadings(DEFAULT_INTERPRETATION)).toEqual([]);
    expect(expectOk(evaluate(scenario(rect(50, 60), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]))).nonDefaultReadings).toEqual([]);
  });

  it('names a reading left at the less conservative side, though no rule is off', () => {
    // The reviewer's case: parking left out of FAR on a 50 x 60 plot builds about 1.85 x the FAR area.
    const e = expectOk(evaluate(scenario(rect(50, 60), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], { parkingCountsInFar: false })));
    expect(e.hypothetical).toBe(false);
    expect(e.nonDefaultReadings).toEqual(['Parking floors are not counted toward the floor area ratio.']);
  });

  it('lists each reading that differs, in a fixed order', () => {
    expect(nonDefaultReadings({ parkingCountsInFar: false, officeParkingCountsInOperatingArea: false, frontOpenSpaceOnPublicRoad: false })).toEqual([
      'Parking floors are not counted toward the floor area ratio.',
      "An office's own parking floors are not counted in its operating area for the plan's office size limit.",
    ]);
  });

  it('does not list a setting moved to the stricter side', () => {
    expect(nonDefaultReadings({ ...DEFAULT_INTERPRETATION, frontOpenSpaceOnPublicRoad: true })).toEqual([]);
  });
});

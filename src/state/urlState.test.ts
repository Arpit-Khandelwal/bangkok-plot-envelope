import { describe, expect, it } from 'vitest';
import type { Assumptions, BuildingType } from '../core/types';
import { DEFAULT_ASSUMPTIONS, DEFAULT_INTERPRETATION } from './defaults';
import { PRESETS } from './presets';
import { decodeScenario, encodeScenario } from './urlState';
import type { ScenarioFields } from './urlState';

const TYPICAL_MAX_LENGTH = 250;

function fieldsOf(preset: (typeof PRESETS)[number]): ScenarioFields {
  return {
    plot: preset.plot,
    edges: preset.edges,
    buildingType: preset.buildingType,
    assumptions: DEFAULT_ASSUMPTIONS[preset.buildingType],
    interpretation: DEFAULT_INTERPRETATION,
    disabledRuleIds: [],
    selectedDesignId: null,
  };
}

const BASE = fieldsOf(PRESETS[0] as (typeof PRESETS)[number]);

describe('round trip', () => {
  it.each(PRESETS.map((preset) => [preset.id, preset] as const))('restores preset %s and stays short', (_id, preset) => {
    const encoded = encodeScenario(fieldsOf(preset));
    const decoded = decodeScenario(`#${encoded}`);
    expect(decoded).not.toBeNull();
    expect(decoded?.plot).toHaveLength(preset.plot.length);
    decoded?.plot.forEach(([lng, lat], index) => {
      expect(Math.abs(lng - (preset.plot[index]?.[0] ?? NaN))).toBeLessThan(1e-6);
      expect(Math.abs(lat - (preset.plot[index]?.[1] ?? NaN))).toBeLessThan(1e-6);
    });
    expect(decoded?.edges).toEqual(preset.edges);
    expect(decoded?.buildingType).toBe(preset.buildingType);
    expect(decoded?.assumptions).toEqual(DEFAULT_ASSUMPTIONS[preset.buildingType]);
    expect(encoded.length).toBeLessThan(TYPICAL_MAX_LENGTH);
    expect(encoded).toMatch(/^v1=[0-9a-z.,~:-]+$/);
  });

  it('keeps non-default assumptions, interpretation, disabled rules, design and edge kinds', () => {
    const assumptions: Assumptions = { ...DEFAULT_ASSUMPTIONS.office, floorToFloorM: 4.25, efficiency: 0.75, parapetM: 0 };
    const state: ScenarioFields = {
      ...BASE,
      buildingType: 'office',
      assumptions,
      interpretation: { parkingCountsInFar: false, officeParkingCountsInOperatingArea: false },
      edges: [{ kind: 'waterway', widthM: 12.5 }, { kind: 'road', roadId: 'road-2', rowWidthM: 16.5 }, { kind: 'neighbour' }, { kind: 'neighbour' }],
      disabledRuleIds: ['mr33.far-10', 'bma.parking'],
      selectedDesignId: 'slender-tower',
    };
    expect(decodeScenario(encodeScenario(state))).toEqual({ ...state, plot: expect.any(Array) });
  });

  it('writes only differences from the defaults', () => {
    const encoded = encodeScenario(BASE);
    expect(encoded.split('~')).toHaveLength(3);
  });

  it('measures assumption defaults against the chosen building type', () => {
    const type: BuildingType = 'office';
    const decoded = decodeScenario(encodeScenario({ ...BASE, buildingType: type, assumptions: DEFAULT_ASSUMPTIONS[type] }));
    expect(decoded?.assumptions).toEqual(DEFAULT_ASSUMPTIONS.office);
  });
});

describe('decodeScenario rejects bad input', () => {
  const good = encodeScenario(BASE);
  const sections = [...good.slice(3).split('~'), '', '', '', ''].slice(0, 7);
  const rebuild = (patch: Partial<Record<number, string>>): string =>
    `v1=${sections.map((section, index) => patch[index] ?? section).join('~')}`;

  const huge = `v1=${Array.from({ length: 10000 }, () => '1,1').join(',')}~${Array.from({ length: 10000 }, () => 'n').join(',')}~c`;

  const cases: ReadonlyArray<readonly [string, string]> = [
    ['empty', ''],
    ['hash only', '#'],
    ['garbage', 'hello world'],
    ['truncated', good.slice(0, 20)],
    ['wrong version', good.replace('v1=', 'v2=')],
    ['no version', good.slice(3)],
    ['huge', huge],
    ['10,000 chars of x', 'v1='.concat('x'.repeat(10000))],
    ['NaN coordinate', rebuild({ 0: 'NaN,NaN,1,1,2,2,3,3' })],
    ['out-of-box coordinate', rebuild({ 0: 'zzzzzz,zzzzzz,1,1,2,2,3,3' })],
    ['two corners', rebuild({ 0: sections[0]?.split(',').slice(0, 4).join(',') ?? '', 1: 'n,n' })],
    ['odd coordinate count', rebuild({ 0: `${sections[0] ?? ''},5` })],
    ['edge count mismatch', rebuild({ 1: 'n,n,n' })],
    ['road width zero', rebuild({ 1: 'rsoi:0,n,n,n' })],
    ['road width 101', rebuild({ 1: 'rsoi:101,n,n,n' })],
    ['road width NaN', rebuild({ 1: 'rsoi:NaN,n,n,n' })],
    ['road width negative', rebuild({ 1: 'rsoi:-5,n,n,n' })],
    ['road width exponent', rebuild({ 1: 'rsoi:1e1,n,n,n' })],
    ['unknown edge token', rebuild({ 1: 'x,n,n,n' })],
    ['unknown building type', rebuild({ 2: 'z' })],
    ['assumption out of range', rebuild({ 2: 'c', 3: 'f99' })],
    ['assumption unknown key', rebuild({ 2: 'c', 3: 'z1' })],
    ['assumption repeated', rebuild({ 2: 'c', 3: 'f3,f4' })],
    ['assumption not a number', rebuild({ 2: 'c', 3: 'fabc' })],
    ['bad interpretation', rebuild({ 2: 'c', 3: '', 4: 'x' })],
    ['script rule id', rebuild({ 2: 'c', 3: '', 4: '', 5: '<script>alert(1)</script>' })],
    ['uppercase rule id', rebuild({ 2: 'c', 3: '', 4: '', 5: 'ABC' })],
    ['21 rule ids', rebuild({ 2: 'c', 3: '', 4: '', 5: Array.from({ length: 21 }, (_, i) => `r${i}`).join(',') })],
    ['script design id', rebuild({ 2: 'c', 3: '', 4: '', 5: '', 6: 'javascript:alert(1)' })],
    ['script-like road id', rebuild({ 1: 'r<img>:8,n,n,n' })],
    ['too many sections', `${good}~a~b~c`],
    ['bad percent encoding', 'v1=%E0%A4%A'],
  ];

  it.each(cases)('returns null for %s', (_name, input) => {
    expect(decodeScenario(input)).toBeNull();
  });

  it('never throws on non-string input', () => {
    expect(decodeScenario(undefined as unknown as string)).toBeNull();
    expect(decodeScenario(null as unknown as string)).toBeNull();
  });

  it('accepts the good baseline', () => {
    expect(decodeScenario(good)).not.toBeNull();
  });
});

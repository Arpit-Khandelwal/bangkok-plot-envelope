import { beforeAll, describe, expect, it } from 'vitest';
import { evaluate } from '../core/evaluate';
import type { AppliedRule, Design, EdgeSpec, Evaluation, RegimeRules } from '../core/types';
import { locateZone, nearestStation } from '../site/context';
import type { SiteData } from '../site/siteData';
import { DEFAULT_ASSUMPTIONS, DEFAULT_INTERPRETATION } from './defaults';
import { PRESETS, type NamedPlotPreset } from './presets';
import { buildScenario } from './useEvaluation';

// Each test loads a preset the way the app does and asserts what the user would see afterwards.

const SIZE_LIMIT_M2 = 10_000;
const OFFICE_SMALL_LIMIT_M2 = 1_000;
const ROUNDING_M2 = 0.5;
const MIN_VISIBLE_GAP_M2 = 500;
const HIGH_RISE_MIN_ROAD_M = 10;
const SIZE_LIMIT_ROAD_M = 30;
const FAR_RATIO = 5;
const SIZE_RULE = 'plan.use-size';
const FAR_RULE = 'plan.far';
const ACCESS_RULE = 'mr33.access-road';

const rawFiles = import.meta.glob<string>('../../public/data/{zones,stations}.geojson', {
  query: '?raw',
  import: 'default',
});

let site: SiteData | null = null;

beforeAll(async () => {
  const zonesLoader = rawFiles['../../public/data/zones.geojson'];
  const stationsLoader = rawFiles['../../public/data/stations.geojson'];
  if (!zonesLoader || !stationsLoader) throw new Error('Site data files are missing');
  site = {
    buildings: { type: 'FeatureCollection', features: [] },
    zones: JSON.parse(await zonesLoader()) as SiteData['zones'],
    stations: JSON.parse(await stationsLoader()) as SiteData['stations'],
  };
});

type OkEvaluation = Extract<Evaluation, { ok: true }>;

interface Story {
  readonly preset: NamedPlotPreset;
  readonly evaluation: OkEvaluation;
  readonly stationM: number;
  readonly areaM2: number;
}

function presetById(id: string): NamedPlotPreset {
  const found = PRESETS.find((preset) => preset.id === id);
  if (!found) throw new Error(`No preset with id ${id}`);
  return found;
}

/** Builds the scenario exactly as the app does, optionally with different edge settings. */
function tell(id: string, edges?: readonly EdgeSpec[]): Story {
  if (!site) throw new Error('Site data is not loaded');
  const preset = presetById(id);
  const station = nearestStation(preset.plot, site.stations);
  if (!station) throw new Error(`No station for ${id}`);
  const scenario = buildScenario(
    {
      plot: preset.plot,
      edges: edges ?? preset.edges,
      buildingType: preset.buildingType,
      assumptions: DEFAULT_ASSUMPTIONS[preset.buildingType],
      interpretation: DEFAULT_INTERPRETATION,
      disabledRuleIds: [],
    },
    locateZone(preset.plot, site.zones),
    station,
  );
  const evaluation = evaluate(scenario);
  if (!evaluation.ok) throw new Error(`${id} did not evaluate: ${JSON.stringify(evaluation.problems)}`);
  return { preset, evaluation, stationM: station.distanceM, areaM2: evaluation.site.areaM2 };
}

function withRoadWidth(preset: NamedPlotPreset, rowWidthM: number): readonly EdgeSpec[] {
  return preset.edges.map((edge): EdgeSpec => (edge.kind === 'road' ? { ...edge, rowWidthM } : edge));
}

function roadWidths(preset: NamedPlotPreset): readonly number[] {
  return preset.edges.flatMap((edge) => (edge.kind === 'road' ? [edge.rowWidthM] : []));
}

function largestFloorAreaM2(story: Story): number {
  return Math.max(...story.evaluation.designs.map((design) => design.totals.grossFloorAreaM2));
}

function highRiseDesigns(story: Story): readonly Design[] {
  return story.evaluation.designs.filter((design) => design.regime === 'highRise');
}

function rule(regime: RegimeRules, id: string): AppliedRule {
  const found = regime.rules.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Rule ${id} is not listed for ${regime.regime}`);
  return found;
}

function figure(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

describe('what each example plot shows once clicked', () => {
  it('soi-large-far: a high-rise is offered and the 10,000 m² size limit is what caps every design', () => {
    const story = tell('soi-large-far');
    const { highRise } = story.evaluation.regimes;
    expect(story.stationM).toBeGreaterThan(500);
    expect(highRise.rules.available).toBe(true);
    expect(highRiseDesigns(story).length).toBeGreaterThan(0);
    expect(highRise.rules.bindingGfaRuleId).toBe(SIZE_RULE);
    expect(highRise.rules.maxGfaM2).toBe(SIZE_LIMIT_M2);
    expect(largestFloorAreaM2(story)).toBeLessThanOrEqual(SIZE_LIMIT_M2 + ROUNDING_M2);
    expect(largestFloorAreaM2(story)).toBeGreaterThan(SIZE_LIMIT_M2 - 150);
    expect(rule(highRise.rules, SIZE_RULE).requirement).toMatch(/at most 10,000 m²/);
    // The size limit, not road access, is the reason: the floor area ratio would allow more.
    expect(story.preset.description).toContain(figure(story.stationM));
  });

  it('soi-large-near: the same road, a high-rise passes 10,000 m² and the floor area ratio is what caps it', () => {
    const story = tell('soi-large-near');
    const { highRise } = story.evaluation.regimes;
    expect(story.stationM).toBeLessThan(500);
    expect(highRise.rules.available).toBe(true);
    expect(highRiseDesigns(story).length).toBeGreaterThan(0);
    expect(largestFloorAreaM2(story)).toBeGreaterThan(SIZE_LIMIT_M2);
    expect(highRise.rules.maxGfaM2).toBeGreaterThan(SIZE_LIMIT_M2);
    expect(highRise.rules.bindingGfaRuleId).toBe(FAR_RULE);
    expect(rule(highRise.rules, SIZE_RULE).requirement).toMatch(/No use-size limit/);
    expect(story.preset.description).toContain(figure(story.stationM));
  });

  it('the far and near pair differ by a clearly visible floor area, on equal roads and equal plots', () => {
    const far = tell('soi-large-far');
    const near = tell('soi-large-near');
    expect(roadWidths(near.preset)).toEqual(roadWidths(far.preset));
    expect(roadWidths(far.preset).every((w) => w >= HIGH_RISE_MIN_ROAD_M && w < SIZE_LIMIT_ROAD_M)).toBe(true);
    expect(Math.abs(near.areaM2 - far.areaM2)).toBeLessThan(MIN_VISIBLE_GAP_M2 / 5);
    expect(largestFloorAreaM2(near) - largestFloorAreaM2(far)).toBeGreaterThanOrEqual(MIN_VISIBLE_GAP_M2);
  });

  it('sukhumvit-wide-frontage: the road route and the station route both hold and a design passes 10,000 m²', () => {
    const story = tell('sukhumvit-wide-frontage');
    const { highRise } = story.evaluation.regimes;
    const basis = rule(highRise.rules, SIZE_RULE).basis ?? '';
    expect(basis).toMatch(/road route holds/);
    expect(basis).toMatch(/within 500 m/);
    expect(largestFloorAreaM2(story)).toBeGreaterThan(SIZE_LIMIT_M2);
    const tall = highRiseDesigns(story)[0];
    expect(tall?.checks.find((c) => c.ruleId === SIZE_RULE)?.status).toBe('pass');
  });

  it('sukhumvit-narrow-frontage: the road route fails on frontage, the station lifts the limit anyway', () => {
    const story = tell('sukhumvit-narrow-frontage');
    const { highRise } = story.evaluation.regimes;
    const basis = rule(highRise.rules, SIZE_RULE).basis ?? '';
    expect(basis).toMatch(/road route fails/);
    expect(basis).toMatch(/\(19\.\d+ m of frontage\)/);
    expect(basis).toMatch(/within 500 m/);
    expect(rule(highRise.rules, SIZE_RULE).requirement).toMatch(/No use-size limit/);
    expect(largestFloorAreaM2(story)).toBeGreaterThan(SIZE_LIMIT_M2);
    const tall = highRiseDesigns(story)[0];
    expect(tall?.checks.find((c) => c.ruleId === SIZE_RULE)?.status).toBe('pass');
  });

  it('small-far-binds: the floor area ratio, not the size limit, caps a high-rise on a small plot', () => {
    const story = tell('small-far-binds');
    const { highRise } = story.evaluation.regimes;
    expect(story.areaM2).toBeLessThan(SIZE_LIMIT_M2 / FAR_RATIO);
    expect(highRise.rules.available).toBe(true);
    expect(highRise.rules.bindingGfaRuleId).toBe(FAR_RULE);
    expect(highRise.rules.maxGfaM2).toBeCloseTo(story.areaM2 * FAR_RATIO, 0);
    expect(highRise.rules.maxGfaM2).toBeLessThan(SIZE_LIMIT_M2);
    const tall = highRiseDesigns(story).map((d) => d.totals.grossFloorAreaM2);
    expect(Math.max(...tall)).toBeGreaterThan(highRise.rules.maxGfaM2 - 25);
    expect(Math.max(...tall)).toBeLessThanOrEqual(highRise.rules.maxGfaM2 + ROUNDING_M2);
  });

  it('flag-narrow-access: no high-rise because the strip is under 12 m, on a road wide enough', () => {
    const story = tell('flag-narrow-access');
    const { highRise } = story.evaluation.regimes;
    expect(roadWidths(story.preset).every((w) => w >= HIGH_RISE_MIN_ROAD_M)).toBe(true);
    expect(highRise.rules.available).toBe(false);
    expect(highRise.rules.blockedBy).toContain(ACCESS_RULE);
    const access = rule(highRise.rules, ACCESS_RULE);
    expect(access.requirement).toMatch(/at least 12 m of frontage on a road at least 10 m wide/);
    expect(access.basis ?? '').toMatch(/\(9(\.\d+)? m of frontage\)/);
    expect(story.evaluation.designs.length).toBeGreaterThan(0);
    expect(story.evaluation.designs.every((d) => d.regime === 'lowRise')).toBe(true);
  });

  it('corner-two-roads: the 30 m road alone limits height, and the rules list a different setback for each road', () => {
    const story = tell('corner-two-roads');
    const { highRise, lowRise } = story.evaluation.regimes;
    expect(roadWidths(story.preset).slice().sort((a, b) => a - b)).toEqual([10, 30]);
    const heightRule = rule(highRise.rules, 'mr55.height-2x');
    expect(heightRule.requirement).toMatch(/30 m road/);
    expect(heightRule.basis ?? '').toMatch(/wider road governs/);
    expect(highRise.rules.heightPlanes).toHaveLength(1);
    expect(highRise.rules.heightPlanes.every((plane) => plane.rowWidthM === 30)).toBe(true);
    const setbackText = rule(lowRise.rules, 'mr55.road-setback').requirement;
    expect(setbackText).toMatch(/2 m back from the 30 m road/);
    expect(setbackText).toMatch(/1 m back from the 10 m road/);
  });

  it('office-16m-road: the 16 m road lifts the office limit from 1,000 m² to 10,000 m²', () => {
    const story = tell('office-16m-road');
    const narrower = tell('office-16m-road', withRoadWidth(story.preset, 12));
    expect(story.preset.buildingType).toBe('office');
    expect(story.stationM).toBeGreaterThan(500);
    expect(story.evaluation.regimes.lowRise.rules.maxMainUseM2).toBe(SIZE_LIMIT_M2);
    expect(story.evaluation.regimes.lowRise.rules.bindingMainUseRuleId).toBe(SIZE_RULE);
    expect(narrower.evaluation.regimes.lowRise.rules.maxMainUseM2).toBe(OFFICE_SMALL_LIMIT_M2);
    const mainUse = story.evaluation.designs.map((d) => d.totals.mainUseFloorAreaM2);
    expect(Math.max(...mainUse)).toBeGreaterThan(OFFICE_SMALL_LIMIT_M2 * 3);
    const narrowMainUse = narrower.evaluation.designs.map((d) => d.totals.mainUseFloorAreaM2);
    expect(Math.max(...narrowMainUse)).toBeLessThanOrEqual(OFFICE_SMALL_LIMIT_M2 + ROUNDING_M2);
  });
});

describe('every preset has a story test', () => {
  it('covers each preset id', () => {
    expect(PRESETS.map((preset) => preset.id).sort()).toEqual(
      [
        'soi-large-far',
        'soi-large-near',
        'sukhumvit-wide-frontage',
        'sukhumvit-narrow-frontage',
        'small-far-binds',
        'flag-narrow-access',
        'corner-two-roads',
        'office-16m-road',
      ].sort(),
    );
  });
});

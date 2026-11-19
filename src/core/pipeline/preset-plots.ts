/**
 * The eight example plots of the app (src/state/presets.ts), copied here as test fixtures so the
 * core never depends on the app state. Coordinates and edges are the presets'; the zone is ย.7 as
 * for every preset. Station distances are the ones the preset descriptions give (580, 390, 430, 380
 * and 780 m); for small-far-binds, the flag plot and the corner plot, which give none, they are
 * guesses (600, 600 and 450 m).
 */
import type { EdgeSpec, LngLat, Scenario } from '../types';
import { NEIGHBOUR, road, scenario } from './test-scenarios';

export interface PresetPlot {
  readonly id: string;
  readonly scenario: Scenario;
}

interface Raw {
  readonly id: string;
  readonly plot: readonly LngLat[];
  readonly edges: readonly EdgeSpec[];
  readonly stationDistanceM: number;
  readonly buildingType?: 'condo' | 'office';
}

const N = NEIGHBOUR;

const RAW: readonly Raw[] = [
  {
    id: 'soi-large-far',
    plot: [[100.602816, 13.690336], [100.603252, 13.690512], [100.60314, 13.690859], [100.602636, 13.690633]],
    edges: [N, N, road(8, 'soi'), N],
    stationDistanceM: 580,
  },
  {
    id: 'soi-large-near',
    plot: [[100.610089, 13.693582], [100.610244, 13.693146], [100.610605, 13.693237], [100.610402, 13.693741]],
    edges: [N, N, road(8, 'soi'), N],
    stationDistanceM: 390,
  },
  {
    id: 'sukhumvit-wide-frontage',
    plot: [[100.603047, 13.701154], [100.602903, 13.701457], [100.602395, 13.701195], [100.602546, 13.700945]],
    edges: [road(30, 'sukhumvit'), N, N, N],
    stationDistanceM: 430,
  },
  {
    id: 'sukhumvit-narrow-frontage',
    plot: [[100.609605, 13.685244], [100.609642, 13.684884], [100.610295, 13.685041], [100.610276, 13.68522]],
    edges: [N, N, road(30, 'sukhumvit'), N],
    stationDistanceM: 380,
  },
  {
    id: 'small-far-binds',
    plot: [[100.605947, 13.687167], [100.605703, 13.687055], [100.605871, 13.686732], [100.60614, 13.686891]],
    edges: [N, N, road(8, 'soi'), N],
    stationDistanceM: 600,
  },
  {
    id: 'flag-narrow-access',
    plot: [
      [100.603351, 13.687623], [100.603314, 13.687696], [100.603132, 13.687606], [100.603061, 13.687744],
      [100.60283, 13.68763], [100.603005, 13.687291], [100.603236, 13.687405], [100.60317, 13.687534],
    ],
    edges: [road(8, 'soi'), N, N, N, N, N, N, N],
    stationDistanceM: 600,
  },
  {
    id: 'corner-two-roads',
    plot: [[100.604814, 13.698938], [100.604639, 13.699238], [100.604325, 13.699148], [100.604491, 13.698805]],
    edges: [N, N, road(30, 'sukhumvit'), road(10, 'soi-93')],
    stationDistanceM: 450,
  },
  {
    id: 'office-16m-road',
    plot: [[100.615763, 13.684449], [100.61604, 13.684454], [100.616005, 13.684869], [100.615766, 13.684838]],
    edges: [road(16, 'soi'), N, N, N],
    stationDistanceM: 780,
    buildingType: 'office',
  },
];

export function presetPlots(): readonly PresetPlot[] {
  return RAW.map((r) => {
    const base = scenario([], r.edges, { buildingType: r.buildingType ?? 'condo', stationDistanceM: r.stationDistanceM });
    return { id: r.id, scenario: { ...base, plot: r.plot } };
  });
}

/** The flag-shaped plot with its 9 m access strip. */
export function flagPlot(): Scenario {
  const found = presetPlots().find((p) => p.id === 'flag-narrow-access');
  if (found === undefined) throw new Error('flag plot fixture missing');
  return found.scenario;
}

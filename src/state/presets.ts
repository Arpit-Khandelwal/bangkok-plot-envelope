import type { PlotPreset } from './store';

/** A real plot the user can load to see the tool work without drawing. */
export interface NamedPlotPreset extends PlotPreset {
  readonly id: string;
  readonly label: string;
  /** One line on what makes this plot interesting. */
  readonly description: string;
}

/**
 * Example plots inside zone ย.7, each placed beside a real street block near BTS Bang Chak
 * and BTS Punnawithi (road centrelines from Overture, building footprints for context).
 * Together they trip each legal threshold. Road widths are assumed examples: in the real
 * tool the user confirms them.
 */
export const ROAD_WIDTH_NOTE = 'Road widths in these examples are assumed. Enter the measured width for a real plot.';

export const PRESETS: readonly NamedPlotPreset[] = [
  {
    id: 'soi-large-far',
    label: 'Large plot on a narrow soi, far from the BTS',
    description:
      'About 2,460 m² on a 12 m soi, 581 m from the BTS: every design is capped at 10,000 m².',
    buildingType: 'condo',
    plot: [
      [100.602843, 13.690291],
      [100.603269, 13.69046],
      [100.60314, 13.690859],
      [100.602636, 13.690633],
    ],
    edges: [
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'road', roadId: 'soi', rowWidthM: 12 },
      { kind: 'neighbour' },
    ],
  },
  {
    id: 'soi-large-near',
    label: 'Same plot, near the BTS',
    description:
      'The same 2,460 m² on a 12 m soi, 384 m from the BTS: no size cap, so a tower reaches 12,295 m².',
    buildingType: 'condo',
    plot: [
      [100.610042, 13.693558],
      [100.61019, 13.693132],
      [100.610605, 13.693237],
      [100.610402, 13.693741],
    ],
    edges: [
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'road', roadId: 'soi', rowWidthM: 12 },
      { kind: 'neighbour' },
    ],
  },
  {
    id: 'sukhumvit-wide-frontage',
    label: 'Sukhumvit frontage, 37 m wide',
    description:
      '37 m of frontage on a 30 m road, 430 m from a platform: both routes pass, a tower reaches 10,397 m².',
    buildingType: 'condo',
    plot: [
      [100.603047, 13.701154],
      [100.602903, 13.701457],
      [100.602395, 13.701195],
      [100.602546, 13.700945],
    ],
    edges: [
      { kind: 'road', roadId: 'sukhumvit', rowWidthM: 30 },
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'neighbour' },
    ],
  },
  {
    id: 'sukhumvit-narrow-frontage',
    label: 'Sukhumvit frontage, only 20 m',
    description:
      '20 m of frontage on a 30 m road fails that route, but 377 m from a platform lifts the cap (10,788 m²).',
    buildingType: 'condo',
    plot: [
      [100.609605, 13.685244],
      [100.609642, 13.684884],
      [100.610295, 13.685041],
      [100.610276, 13.68522],
    ],
    edges: [
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'road', roadId: 'sukhumvit', rowWidthM: 30 },
      { kind: 'neighbour' },
    ],
  },
  {
    id: 'small-far-binds',
    label: 'Small plot, floor-area ratio is the limit',
    description:
      'About 1,210 m² on a 12 m soi: the floor area ratio caps a tower at 6,061 m², well under 10,000 m².',
    buildingType: 'condo',
    plot: [
      [100.605947, 13.687167],
      [100.605703, 13.687055],
      [100.605871, 13.686732],
      [100.60614, 13.686891],
    ],
    edges: [
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'road', roadId: 'soi', rowWidthM: 12 },
      { kind: 'neighbour' },
    ],
  },
  {
    id: 'flag-narrow-access',
    label: 'Flag-shaped plot, 9 m access strip',
    description:
      'A flag plot with a 9 m strip on a 12 m soi: under 12 m of frontage, so low-rise only (3,268 m²).',
    buildingType: 'condo',
    plot: [
      [100.603351, 13.687623],
      [100.603314, 13.687696],
      [100.603132, 13.687606],
      [100.603061, 13.687744],
      [100.60283, 13.68763],
      [100.603005, 13.687291],
      [100.603236, 13.687405],
      [100.60317, 13.687534],
    ],
    edges: [
      { kind: 'road', roadId: 'soi', rowWidthM: 12 },
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'neighbour' },
    ],
  },
  {
    id: 'corner-two-roads',
    label: 'Corner of Sukhumvit and a soi',
    description:
      'Corner of a 30 m road and a 10 m soi: only the 30 m road limits height; each road has its own setback.',
    buildingType: 'condo',
    plot: [
      [100.604814, 13.698938],
      [100.604639, 13.699238],
      [100.604325, 13.699148],
      [100.604491, 13.698805],
    ],
    edges: [
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'road', roadId: 'sukhumvit', rowWidthM: 30 },
      { kind: 'road', roadId: 'soi-93', rowWidthM: 10 },
    ],
  },
  {
    id: 'office-16m-road',
    label: 'Office on a 16 m street',
    description:
      'Office 777 m from a station on a 16 m road: up to 10,000 m² of operating area, not 1,000 m².',
    buildingType: 'office',
    plot: [
      [100.615763, 13.684449],
      [100.61604, 13.684454],
      [100.616005, 13.684869],
      [100.615766, 13.684838],
    ],
    edges: [
      { kind: 'road', roadId: 'soi', rowWidthM: 16 },
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'neighbour' },
    ],
  },
];

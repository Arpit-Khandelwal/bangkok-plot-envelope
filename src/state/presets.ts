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
export const PRESETS: readonly NamedPlotPreset[] = [
  {
    id: 'soi-large-far',
    label: 'Large plot on a narrow soi, far from the BTS',
    description:
      'About 2,160 m2 on Soi Phong Wet Anuson, 580 m from BTS Punnawithi: the 10,000 m2 condo limit binds (the 8 m soi width is an assumed example).',
    buildingType: 'condo',
    plot: [
      [100.602816, 13.690336],
      [100.603252, 13.690512],
      [100.60314, 13.690859],
      [100.602636, 13.690633],
    ],
    edges: [
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'road', roadId: 'soi', rowWidthM: 8 },
      { kind: 'neighbour' },
    ],
  },
  {
    id: 'soi-large-near',
    label: 'Same plot, near the BTS',
    description:
      'Same size and shape on Soi Punnawithi 9, 390 m from BTS Punnawithi: being close to the station lifts the 10,000 m2 limit (the 8 m soi width is an assumed example).',
    buildingType: 'condo',
    plot: [
      [100.610089, 13.693582],
      [100.610244, 13.693146],
      [100.610605, 13.693237],
      [100.610402, 13.693741],
    ],
    edges: [
      { kind: 'neighbour' },
      { kind: 'neighbour' },
      { kind: 'road', roadId: 'soi', rowWidthM: 8 },
      { kind: 'neighbour' },
    ],
  },
  {
    id: 'sukhumvit-wide-frontage',
    label: 'Sukhumvit frontage, 37 m wide',
    description:
      '37 m of frontage on Sukhumvit Road, 430 m from a platform (no spot in this zone is farther than about 450 m, so the station route also applies); the 30 m road width is an assumed example.',
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
      'Only 20 m of frontage on Sukhumvit Road: the 30 m road route fails on frontage, and only the 380 m station distance lifts the limit (the 30 m road width is an assumed example).',
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
    label: 'Small plot, floor-area ratio binds',
    description:
      'About 1,200 m2 on Soi Sukhumvit 64, under 2,000 m2, so the floor-area ratio and not the 10,000 m2 size limit caps the building (the 8 m soi width is an assumed example).',
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
      { kind: 'road', roadId: 'soi', rowWidthM: 8 },
      { kind: 'neighbour' },
    ],
  },
  {
    id: 'flag-narrow-access',
    label: 'Flag-shaped plot, 9 m access strip',
    description:
      'A flag-shaped plot reached by a 9 m strip off Soi Siri Wanit Yaek 7: under 12 m of road frontage, so a high-rise is not allowed at all (the 8 m soi width is an assumed example).',
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
      { kind: 'road', roadId: 'soi', rowWidthM: 8 },
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
      'Corner plot on Sukhumvit Road and Soi Sukhumvit 93, two roads of different widths; both widths (30 m and 10 m) are assumed examples.',
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
      'An office on Soi Sukhumvit 101/1, 780 m from a station, with 30 m of frontage: the 16 m road test decides whether it can exceed 1,000 m2 (the mapped estimate is 10 m, so the 16 m width is an assumed example).',
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

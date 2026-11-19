/** A deterministic family of plots for the invariant tests: many shapes, sizes, roads and uses. */
import type { EdgeSpec, Pt, Scenario } from '../types';
import { NEIGHBOUR, road, scenario } from './test-scenarios';
import type { ScenarioOptions } from './test-scenarios';

export interface TestPlot {
  readonly name: string;
  readonly scenario: Scenario;
}

function rotate(points: readonly Pt[], degrees: number): Pt[] {
  const a = (degrees * Math.PI) / 180;
  return points.map((p) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) }));
}

const SHAPES: ReadonlyArray<readonly [string, readonly Pt[]]> = [
  ['rect 15x10 (150 m²)', [{ x: 0, y: 0 }, { x: 15, y: 0 }, { x: 15, y: 10 }, { x: 0, y: 10 }]],
  ['rect 20x30', [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 30 }, { x: 0, y: 30 }]],
  ['rect 50x50', [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }]],
  ['rect 12x60 deep', [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 60 }, { x: 0, y: 60 }]],
  ['rect 100x200 (20,000 m²)', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: 0, y: 200 }]],
  ['L-shape', [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 20 }, { x: 25, y: 20 }, { x: 25, y: 50 }, { x: 0, y: 50 }]],
  ['triangle', [{ x: 0, y: 0 }, { x: 70, y: 0 }, { x: 20, y: 60 }]],
  ['trapezoid', [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 60, y: 40 }, { x: 15, y: 40 }]],
  [
    'concave 8-gon',
    [
      { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 45 }, { x: 40, y: 45 },
      { x: 40, y: 20 }, { x: 20, y: 20 }, { x: 20, y: 45 }, { x: 0, y: 45 },
    ],
  ],
  ['rotated rect 40x70', rotate([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 70 }, { x: 0, y: 70 }], 33)],
];

const ROAD_WIDTHS = [4, 6, 8, 10, 12, 16, 20, 30, 40];
const STATIONS: ReadonlyArray<number | null> = [250, 800, null, 510];

function edgesFor(n: number, width: number, twoRoads: boolean): EdgeSpec[] {
  return Array.from({ length: n }, (_, i) => {
    if (i === 0) return road(width, 'main');
    if (twoRoads && i === 1) return road(Math.max(4, width - 4), 'side');
    return NEIGHBOUR;
  });
}

/** Clockwise copy: the same plot drawn the other way round, road still on drawn edge 0. */
function clockwise(points: readonly Pt[]): Pt[] {
  return [...points].reverse();
}

/** At least 30 scenarios; the same list on every run. */
export function testPlots(): readonly TestPlot[] {
  const out: TestPlot[] = [];
  SHAPES.forEach(([name, points], i) => {
    for (let variant = 0; variant < 3; variant++) {
      const k = i * 3 + variant;
      const width = ROAD_WIDTHS[k % ROAD_WIDTHS.length] ?? 12;
      const twoRoads = variant === 2;
      const isCw = variant === 1;
      const pts = isCw ? clockwise(points) : points;
      const options: ScenarioOptions = {
        buildingType: k % 4 === 3 ? 'office' : 'condo',
        stationDistanceM: STATIONS[k % STATIONS.length] ?? null,
      };
      out.push({
        name: `${name}, ${isCw ? 'clockwise' : 'counter-clockwise'}, ${twoRoads ? 'two roads' : 'one road'} ${width} m, ${options.buildingType}`,
        scenario: scenario(pts, edgesFor(pts.length, width, twoRoads), options),
      });
    }
  });
  return out;
}

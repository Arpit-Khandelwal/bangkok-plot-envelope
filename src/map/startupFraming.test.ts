/**
 * The startup framing bug, reproduced against the real baked buildings: a plot restored from the
 * link was framed from the road side before any building had loaded, which puts a 92 m tower
 * in front of this example. Once the parts around the plot are in, `chooseView` must pick the
 * same clear view whether or not the rest of the area has loaded.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';
import { BUILDING_PARTS, withPartIds, type BuildingPart } from '../site/buildingParts';
import { decodeScenario } from '../state/urlState';
import { buildingsOnPlot, indexFootprints, type BuildingFootprint } from './buildingsOnPlot';
import { roadSideBearing } from './framing';
import { partsAround } from './partOrder';
import { chooseView, OCCLUDER_RANGE_M } from './viewChoice';

const EXAMPLE_HASH = '#v1=1nw9t3,85nvm,-40,8f,-i4,15,-dx,-5t~rsukhumvit:30,n,n,n~c';
const EXPECTED_BEARING = -100;
const BEARING_TOLERANCE = 10;

function footprintsOf(parts: readonly BuildingPart[]): BuildingFootprint[] {
  return parts.flatMap((part) => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'public', part.url), 'utf8')) as FeatureCollection;
    return indexFootprints(withPartIds(raw, part.index).features);
  });
}

function angularGap(a: number, b: number): number {
  return Math.abs(((((a - b + 180) % 360) + 360) % 360) - 180);
}

describe('framing a plot restored from the link', () => {
  const scenario = decodeScenario(EXAMPLE_HASH);
  if (!scenario) throw new Error('example hash no longer decodes');
  const { plot, edges } = scenario;

  function viewWith(footprints: readonly BuildingFootprint[]): number {
    const hiddenIds = new Set(buildingsOnPlot(footprints, plot));
    return chooseView({ plot, edges, buildings: footprints, hiddenIds, currentBearing: 0 }).bearing;
  }

  it('needs only a few parts for the occlusion test', () => {
    const around = partsAround(BUILDING_PARTS, plot, OCCLUDER_RANGE_M);
    expect(around.length).toBeGreaterThan(0);
    expect(around.length).toBeLessThan(BUILDING_PARTS.length);
  });

  it('chooses the clear view once the parts around the plot have loaded, the same as with every part', () => {
    const around = new Set(partsAround(BUILDING_PARTS, plot, OCCLUDER_RANGE_M));
    const nearby = viewWith(footprintsOf(BUILDING_PARTS.filter((part) => around.has(part.index))));
    const everything = viewWith(footprintsOf(BUILDING_PARTS));
    expect(nearby).toBe(everything);
    expect(angularGap(nearby, EXPECTED_BEARING)).toBeLessThanOrEqual(BEARING_TOLERANCE);
  });

  it('differs from the road-side bearing used before any building has loaded', () => {
    const roadSide = roadSideBearing(plot, edges);
    expect(roadSide).not.toBeNull();
    expect(angularGap(roadSide ?? 0, EXPECTED_BEARING)).toBeGreaterThan(BEARING_TOLERANCE);
  });
});

/** Habitable floors: no floor narrower than a usable width, on flag plots, narrow plots and step-backs. */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { openRegion, regionArea, regionWidth } from '../geom';
import { flagPlot } from '../pipeline/preset-plots';
import { expectOk, designById, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import type { Design, Pt } from '../types';
import { MIN_MAIN_WIDTH_M, MIN_PARKING_WIDTH_M, minWidthFor } from './habitable';
import { clipToHeight } from './plate';
import { MIN_VIABLE_PLATE_M2 } from './stack';

const NARROW_TOLERANCE_M2 = 0.5;
/** The flag plot's allowed footprint before this change, access strip included (m²). */
const FLAG_FOOTPRINT_M2 = 865;
/** Its access strip, about 3 m wide after the side setbacks, is about this big (m²). */
const FLAG_STRIP_M2 = 50;

function narrowLoss(d: Design): number {
  return Math.max(0, ...d.floors.map((f) => regionArea(f.outline) - regionArea(openRegion(f.outline, minWidthFor(f.use)))));
}

describe('minimum widths', () => {
  it('are 8 m for main use and 6 m for parking', () => {
    expect(MIN_MAIN_WIDTH_M).toBe(8);
    expect(MIN_PARKING_WIDTH_M).toBe(6);
    expect(minWidthFor('residential')).toBe(8);
    expect(minWidthFor('office')).toBe(8);
    expect(minWidthFor('parking')).toBe(6);
  });
});

describe('flag-shaped plot with a 9 m access strip', () => {
  const e = expectOk(evaluate(flagPlot()));

  it('still offers at least two designs', () => {
    expect(e.designs.length).toBeGreaterThanOrEqual(2);
  });

  it('builds nothing down the access strip', () => {
    for (const d of e.designs) {
      expect(narrowLoss(d)).toBeLessThan(NARROW_TOLERANCE_M2);
      expect(d.totals.coverageM2).toBeLessThan(FLAG_FOOTPRINT_M2 - FLAG_STRIP_M2);
    }
  });
});

describe('a flag plot whose access strip is a large share of the footprint', () => {
  // A 10 m wide, 50 m long strip from the road to a 36 x 30 m lot at the back.
  const pts: Pt[] = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 50 }, { x: 23, y: 50 }, { x: 23, y: 80 }, { x: -13, y: 80 }, { x: -13, y: 50 }, { x: 0, y: 50 },
  ];
  const e = expectOk(evaluate(scenario(pts, pts.map((_, i) => (i === 0 ? road(8) : NEIGHBOUR)))));

  it('says the strip is left open', () => {
    expect(e.designs.length).toBeGreaterThan(0);
    for (const d of e.designs) {
      expect(d.summary).toContain('The narrow access strip is left open');
      expect(narrowLoss(d)).toBeLessThan(NARROW_TOLERANCE_M2);
    }
  });
});

describe('a plot too narrow for a usable floor', () => {
  // 12 m wide: 3 m side setbacks leave a 6 m wide strip.
  const e = expectOk(evaluate(scenario(rect(12, 60), [road(8), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));

  it('offers no design and says why in plain words, without blocking', () => {
    expect(e.designs).toEqual([]);
    const problem = e.problems.find((p) => p.code === 'no-design');
    expect(problem?.blocking).toBe(false);
    expect(problem?.message).toBe(
      'The buildable part of this plot is only about 6 m wide after setbacks, too narrow for a usable floor.',
    );
  });
});

describe('step-back terraces', () => {
  // A long, shallow plot on a 12 m road: the slender tower steps back from the road as it rises.
  const shallow = scenario(rect(80, 30), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]);
  const e = expectOk(evaluate(shallow));
  const tower = designById(e, 'slender-tower');
  const levels = [...new Set(tower.floors.map((f) => f.level))];
  const top = tower.floors.filter((f) => f.level === levels.length);

  it('shrinks the upper floors and keeps every one habitable', () => {
    const areas = levels.map((l) => tower.floors.filter((f) => f.level === l).reduce((s, f) => s + f.areaM2, 0));
    expect(areas[areas.length - 1]).toBeLessThan(areas[0] ?? 0);
    expect(narrowLoss(tower)).toBeLessThan(NARROW_TOLERANCE_M2);
    for (const f of top) expect(regionWidth(f.outline)).toBeGreaterThanOrEqual(MIN_MAIN_WIDTH_M - 0.1);
  });

  it('ends the stack where the next step-back would leave only a thin strip', () => {
    const last = top[0];
    if (last === undefined) throw new Error('no top floor');
    const planes = e.regimes.highRise.rules.heightPlanes;
    const nextTop = last.topM + (last.topM - last.baseM) + shallow.assumptions.parapetM;
    const strip = clipToHeight(e.site, last.outline, planes, nextTop);
    // The plane alone would leave a strip big enough to count as a floor, but too narrow to use.
    expect(regionArea(strip)).toBeGreaterThan(MIN_VIABLE_PLATE_M2);
    expect(regionWidth(strip)).toBeLessThan(MIN_MAIN_WIDTH_M);
  });
});

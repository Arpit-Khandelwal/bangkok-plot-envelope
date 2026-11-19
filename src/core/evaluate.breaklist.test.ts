/** Inputs a reviewer would try in order to break the tool, end to end through `evaluate`. */
import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate';
import { largestPiece } from './geom';
import { expectOk, NEIGHBOUR, rect, road, scenario } from './pipeline/test-scenarios';
import type { EdgeSpec, Evaluation, Pt } from './types';

const FOUR = (first: EdgeSpec): EdgeSpec[] => [first, NEIGHBOUR, NEIGHBOUR, NEIGHBOUR];

function codes(e: Evaluation): string[] {
  return e.problems.map((p) => p.code);
}

/** Every message is a plain sentence: no placeholders leaking through. */
function expectPlainMessages(e: Evaluation): void {
  for (const p of e.problems) {
    expect(p.message.length).toBeGreaterThan(20);
    expect(p.message).not.toMatch(/undefined|NaN|null|\[object/);
  }
}

function circle(radius: number, corners: number): Pt[] {
  return Array.from({ length: corners }, (_, i) => {
    const a = (2 * Math.PI * i) / corners;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  });
}

/** Two 30 x 30 squares joined by a 4 m wide neck: the 3 m side setbacks cut the neck. */
const DUMBBELL: Pt[] = [
  { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 13 }, { x: 40, y: 13 }, { x: 40, y: 0 }, { x: 70, y: 0 },
  { x: 70, y: 30 }, { x: 40, y: 30 }, { x: 40, y: 17 }, { x: 30, y: 17 }, { x: 30, y: 30 }, { x: 0, y: 30 },
];

describe('break list', () => {
  it('rejects a self-intersecting plot without a site', () => {
    const bowTie = [{ x: 0, y: 0 }, { x: 40, y: 40 }, { x: 40, y: 0 }, { x: 0, y: 40 }];
    const e = evaluate(scenario(bowTie, FOUR(road(12))));
    expect(e.ok).toBe(false);
    expect(codes(e)).toEqual(['self-intersecting']);
    expect(e.site).toBeNull();
    expectPlainMessages(e);
  });

  it('rejects a 3-point sliver as having no area', () => {
    const e = evaluate(scenario([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0.001 }], [road(12), NEIGHBOUR, NEIGHBOUR]));
    expect(codes(e)).toEqual(['zero-area']);
    expectPlainMessages(e);
  });

  it('rejects a tiny and a huge plot', () => {
    expect(codes(evaluate(scenario(rect(5, 5), FOUR(road(12)))))).toEqual(['too-small']);
    expect(codes(evaluate(scenario(rect(1000, 1000), FOUR(road(12)))))).toEqual(['too-large']);
  });

  it('asks for a road edge, keeping the site', () => {
    const e = evaluate(scenario(rect(40, 40), FOUR(NEIGHBOUR)));
    expect(e.ok).toBe(false);
    expect(codes(e)).toEqual(['no-road']);
    expect(e.problems[0]?.message).toBe('Mark the edge that faces the road. Setbacks and the height limit are measured from it.');
    expect(e.site?.areaM2).toBeCloseTo(1600, 0);
  });

  it('handles a plot with roads on every edge', () => {
    const e = expectOk(evaluate(scenario(rect(50, 50), [road(12, 'a'), road(10, 'b'), road(12, 'c'), road(8, 'd')])));
    expect(e.designs.length).toBeGreaterThanOrEqual(2);
    expect(e.designs.every((d) => d.passes)).toBe(true);
  });

  it.each([0, -5, Number.NaN, 200])('rejects a road width of %s, keeping the site', (width) => {
    const e = evaluate(scenario(rect(40, 40), FOUR(road(width))));
    expect(e.ok).toBe(false);
    expect(codes(e)).toEqual(['invalid-road-width']);
    expect(e.problems[0]?.message).toContain('edge A');
    expect(e.site).not.toBeNull();
    expectPlainMessages(e);
  });

  it('reports a plot outside any zone, and an unsupported zone by name', () => {
    expect(codes(evaluate(scenario(rect(40, 40), FOUR(road(12)), { zone: null })))).toEqual(['outside-zone']);
    const e = evaluate(scenario(rect(40, 40), FOUR(road(12)), { zone: { code: 'พ.5', planVersion: '2556' } }));
    expect(codes(e)).toEqual(['unsupported-zone']);
    expect(e.problems[0]?.message).toContain('พ.5');
    expect(e.site).not.toBeNull();
  });

  it('says which setbacks consume a plot that leaves nothing to build', () => {
    // 5 m wide: 3 m from each neighbouring side leaves no width.
    const e = evaluate(scenario(rect(5, 12), FOUR(road(12))));
    expect(e.ok).toBe(false);
    expect(codes(e)).toEqual(['nothing-buildable']);
    expect(e.problems[0]?.message).toContain('3 m from edges B, C and D');
    expect(e.site).not.toBeNull();
    expectPlainMessages(e);
  });

  it('builds one building on the larger piece of a plot split in two by setbacks', () => {
    const edges = DUMBBELL.map((_, i) => (i === 0 ? road(12) : NEIGHBOUR));
    const e = expectOk(evaluate(scenario(DUMBBELL, edges)));
    expect(e.regimes.lowRise.envelope?.footprint.length).toBe(2);
    expect(e.designs.length).toBeGreaterThanOrEqual(2);
    for (const d of e.designs) for (const f of d.floors) expect(largestPiece(f.outline)).toEqual(f.outline);
  });

  it('evaluates a 500-corner plot', () => {
    const points = circle(60, 500);
    const edges = points.map((_, i) => (i < 20 ? road(16) : NEIGHBOUR));
    const e = expectOk(evaluate(scenario(points, edges)));
    expect(e.site.edges).toHaveLength(500);
    expect(e.designs.length).toBeGreaterThanOrEqual(2);
    expect(e.designs.every((d) => d.passes)).toBe(true);
  });

  it('survives absurd assumptions', () => {
    const base = scenario(rect(50, 50), FOUR(road(12)));
    const bad = {
      ...base,
      assumptions: { ...base.assumptions, floorToFloorM: 0, parkingFloorToFloorM: Number.NaN, parkingM2PerStall: 0, averageUnitM2: -1, efficiency: 7 },
    };
    const e = expectOk(evaluate(bad));
    expect(e.designs.length).toBeGreaterThanOrEqual(2);
    expect(e.designs.every((d) => d.passes)).toBe(true);
  });
});

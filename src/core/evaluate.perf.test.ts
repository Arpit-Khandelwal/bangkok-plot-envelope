/** Evaluation must keep up with dragging a corner on the map. Medians of warm runs. */
import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate';
import { NEIGHBOUR, rect, road, scenario } from './pipeline/test-scenarios';
import type { Pt, Scenario } from './types';

const TYPICAL_BUDGET_MS = 40;
const MANY_CORNERS_BUDGET_MS = 400;

function medianMs(s: Scenario, runs: number): number {
  evaluate(s);
  const times = Array.from({ length: runs }, () => {
    const start = performance.now();
    evaluate(s);
    return performance.now() - start;
  });
  return [...times].sort((a, b) => a - b)[Math.floor(runs / 2)] ?? Infinity;
}

const L_SHAPE: Pt[] = [
  { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 20 }, { x: 25, y: 20 }, { x: 25, y: 50 }, { x: 0, y: 50 },
];
const OCTAGON: Pt[] = [
  { x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 45 }, { x: 40, y: 45 },
  { x: 40, y: 20 }, { x: 20, y: 20 }, { x: 20, y: 45 }, { x: 0, y: 45 },
];

describe('performance', () => {
  it.each([
    ['4 corners', scenario(rect(50, 50), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])],
    ['6 corners', scenario(L_SHAPE, L_SHAPE.map((_, i) => (i === 0 ? road(20) : NEIGHBOUR)))],
    ['8 corners', scenario(OCTAGON, OCTAGON.map((_, i) => (i === 0 ? road(30) : NEIGHBOUR)))],
  ])('evaluates a typical plot (%s) in under 40 ms', (_name, s) => {
    expect(medianMs(s, 7)).toBeLessThan(TYPICAL_BUDGET_MS);
  });

  it('evaluates a 500-corner plot in under 400 ms', () => {
    const points = Array.from({ length: 500 }, (_, i) => {
      const a = (2 * Math.PI * i) / 500;
      return { x: 60 * Math.cos(a), y: 60 * Math.sin(a) };
    });
    const s = scenario(points, points.map((_, i) => (i < 20 ? road(16) : NEIGHBOUR)));
    expect(medianMs(s, 3)).toBeLessThan(MANY_CORNERS_BUDGET_MS);
  }, 10_000);
});

/** Frontage is the straight run along a road, not the summed edge length (MR 33 ข้อ 2, plan ข้อ 36). */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import type { EdgeSpec, Pt } from '../types';
import { collectRoads } from './context';

function frontageOf(points: readonly Pt[], edges: readonly EdgeSpec[]): number {
  const e = evaluate(scenario(points, edges));
  if (e.site === null) throw new Error('no site');
  const [first] = collectRoads(e.site);
  if (first === undefined) throw new Error('no road');
  return first.frontageM;
}

function highRiseAvailable(points: readonly Pt[], edges: readonly EdgeSpec[]): boolean {
  const e = evaluate(scenario(points, edges));
  if (!e.ok) throw new Error(e.problems.map((p) => p.message).join(' | '));
  return e.regimes.highRise.rules.available;
}

const SAWTOOTH: Pt[] = [{ x: 0, y: 0 }, { x: 5.5, y: -2.5 }, { x: 11, y: 0 }, { x: 11, y: 60 }, { x: 0, y: 60 }];
const SAWTOOTH_EDGES = [road(12), road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR];

describe('road frontage', () => {
  it('measures a sawtooth frontage as its 11 m straight run, which fails the 12 m access test', () => {
    expect(frontageOf(SAWTOOTH, SAWTOOTH_EDGES)).toBeCloseTo(11, 3);
    expect(highRiseAvailable(SAWTOOTH, SAWTOOTH_EDGES)).toBe(false);
  });

  it('passes a straight 12.00 m edge and fails 11.99 m', () => {
    const four = [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR];
    expect(highRiseAvailable(rect(12, 60), four)).toBe(true);
    expect(highRiseAvailable(rect(11.99, 60), four)).toBe(false);
  });

  it('does not add two separate 8 m frontages on the same road', () => {
    const points: Pt[] = [
      { x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 16, y: 5 },
      { x: 16, y: 0 }, { x: 24, y: 0 }, { x: 24, y: 40 }, { x: 0, y: 40 },
    ];
    const edges = points.map((_, i) => (i === 0 || i === 4 ? road(12, 'same') : NEIGHBOUR));
    expect(frontageOf(points, edges)).toBeCloseTo(8, 3);
    expect(highRiseAvailable(points, edges)).toBe(false);
  });

  it('joins a run that wraps from the last edge to the first', () => {
    const points: Pt[] = [{ x: 6, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 40 }, { x: 0, y: 40 }, { x: 0, y: 0 }];
    // Edges D (0,40)-(0,0) is a neighbour; E (0,0)-(6,0) and A (6,0)-(20,0) are one 20 m run.
    const edges = [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR, road(12)];
    expect(frontageOf(points, edges)).toBeCloseTo(20, 3);
  });
});

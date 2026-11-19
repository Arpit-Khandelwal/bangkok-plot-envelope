/** Edges are named to the user by the letter of the edge as drawn, even when the plot is reversed. */
import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate';
import { designById, expectOk, NEIGHBOUR, road, scenario } from './pipeline/test-scenarios';

describe('edge names through evaluate', () => {
  // Clockwise 50 x 50 m: drawn edge 0 (A) runs up the west side and faces the 12 m road.
  const clockwise = [
    { x: 0, y: 0 },
    { x: 0, y: 50 },
    { x: 50, y: 50 },
    { x: 50, y: 0 },
  ];
  const result = expectOk(evaluate(scenario(clockwise, [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));

  it('names the road edge A in the rule wording', () => {
    const rule = result.regimes.lowRise.rules.rules.find((r) => r.id === 'mr55.road-setback');
    expect(rule?.requirement).toContain('(edge A)');
  });

  it('names the road edge A in the setback check', () => {
    const check = designById(result, 'low-rise-block').checks.find((c) => c.ruleId === 'bma.clear-space');
    expect(check?.required).toContain('edge A');
    expect(check?.actual).toContain('edge A');
  });

  it('cuts the section at the drawn road edge', () => {
    const section = designById(result, 'low-rise-block').section;
    expect(section).not.toBeNull();
    expect(result.site.edges[section?.roadEdgeIndex ?? -1]?.sourceIndex).toBe(0);
  });
});

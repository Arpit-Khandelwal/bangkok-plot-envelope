/** The two lawful forms under the default front-access reading (DECISIONS.md B12). */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { minDistanceToSegment } from '../geom';
import { presetPlots } from '../pipeline/preset-plots';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import type { Design } from '../types';

function preset(id: string) {
  const found = presetPlots().find((p) => p.id === id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  return found.scenario;
}

function gapToRoad(e: ReturnType<typeof expectOk>, d: Design): number {
  const roads = e.site.edges.filter((x) => x.spec.kind === 'road');
  return Math.min(...roads.map((r) => minDistanceToSegment(d.floors.flatMap((f) => f.outline), r.from, r.to)));
}

describe('Form A on the road or Form B set back', () => {
  it('sets the narrow-frontage low-rise back behind a front open space, for more than 3,524 m²', () => {
    // On the road, clause 53 cut the block short to 3,524 m²; set back, it uses the deep plot.
    const e = expectOk(evaluate(preset('sukhumvit-narrow-frontage')));
    const low = designById(e, 'low-rise-block');
    expect(low.totals.grossFloorAreaM2).toBeGreaterThan(3524);
    expect(low.summary).toMatch(/Set back [\d.]+ m from the road behind a front open space \(clause 52\(6\)\), because a building on the road could face it with only [\d.]+ m of a [\d.]+ m perimeter/);
    expect(gapToRoad(e, low)).toBeGreaterThan(20);
    const check = low.checks.find((c) => c.ruleId === 'bma.front-access');
    expect(check?.status).toBe('pass');
    expect(check?.required).toMatch(/^Form: set back\./);
  });

  it('keeps a wide, shallow plot on the road', () => {
    const e = expectOk(evaluate(scenario(rect(80, 40), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    const low = designById(e, 'low-rise-block');
    expect(low.summary).toMatch(/On the road, facing it with/);
    expect(gapToRoad(e, low)).toBeLessThanOrEqual(20);
  });

  it('keeps Form A where a set-back building does not fit (a plot too shallow)', () => {
    const e = expectOk(evaluate(scenario(rect(30, 28), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    for (const d of e.designs) {
      expect(d.summary).toMatch(/On the road, facing it with .*setting it back more than 20 m behind a front open space does not fit here\./);
      expect(gapToRoad(e, d)).toBeLessThanOrEqual(20);
    }
  });

  it('offers on every preset only designs that pass the clause of their own form', () => {
    for (const p of presetPlots()) {
      const e = expectOk(evaluate(p.scenario));
      for (const d of e.designs) {
        expect(d.passes, `${p.id} ${d.id}`).toBe(true);
        const c = d.checks.find((x) => x.ruleId === 'bma.front-access');
        expect(c?.status, `${p.id} ${d.id}`).toBe('pass');
        expect(c?.required.startsWith(gapToRoad(e, d) > 20 ? 'Form: set back.' : 'Form: on the road.')).toBe(true);
      }
    }
  });
});

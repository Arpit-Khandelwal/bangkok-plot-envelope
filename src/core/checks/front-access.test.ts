/** Bangkok ordinance B.E. 2544 ข้อ 52(6) and ข้อ 53: front open space, or a façade facing the road. */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { minDistanceToSegment } from '../geom';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import type { Design } from '../types';

const RULE = 'bma.front-access';
const WARNING =
  'This design needs a front open space at least 12 m wide along at least one sixth of its perimeter, linked to the road by a 6 m internal road (Bangkok ordinance clause 52(6)). The tool does not lay this out.';

function frontCheck(d: Design) {
  const c = d.checks.find((x) => x.ruleId === RULE);
  if (c === undefined) throw new Error(`no ${RULE} check on ${d.id}`);
  return c;
}

describe('front open space (clauses 52(6) and 53)', () => {
  it('passes a block close to the road with a long road-facing façade, stating both values', () => {
    const e = expectOk(evaluate(scenario(rect(50, 50), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    const c = frontCheck(designById(e, 'low-rise-block'));
    expect(c.status).toBe('pass');
    // The plate, inset to the open-space cap, comes 3.33 m from the road with a 41.33 m façade
    // facing it, against one eighth of the 167.32 m perimeter.
    expect(c.actual).toBe('The building comes 3.33 m from the road and has 41.33 m of façade facing it within 20 m.');
    expect(c.required).toMatch(/more than 20\.91 m of façade/);
    expect(e.regimes.lowRise.rules.rules.some((r) => r.id === RULE)).toBe(true);
  });

  it('warns when the façade facing the road is too short a share of the perimeter', () => {
    const e = expectOk(evaluate(scenario(rect(16, 100), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    expect(e.designs.length).toBeGreaterThan(0);
    for (const d of e.designs) {
      const c = frontCheck(d);
      expect(c.status).toBe('warn');
      expect(c.actual).toBe(WARNING);
    }
  });

  it('never fails', () => {
    for (const s of [scenario(rect(16, 100), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]), scenario(rect(40, 40), [road(8), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])]) {
      const e = expectOk(evaluate(s));
      for (const d of e.designs) expect(frontCheck(d).status).not.toBe('fail');
    }
  });

  it('slides the slender tower toward the road to meet clause 53 when the height plane allows', () => {
    // Centred, the tower on a 150 x 150 plot sits about 26 m from the 30 m road.
    const e = expectOk(evaluate(scenario(rect(150, 150), [road(30), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    const tower = designById(e, 'slender-tower');
    expect(frontCheck(tower).status).toBe('pass');
    expect(tower.passes).toBe(true);
    const roadEdge = e.site.edges[0];
    if (roadEdge === undefined) throw new Error('no edge');
    const ground = tower.floors.filter((f) => f.level === 1).flatMap((f) => f.outline);
    expect(minDistanceToSegment(ground, roadEdge.from, roadEdge.to)).toBeLessThanOrEqual(20 + 1e-6);
  });
});

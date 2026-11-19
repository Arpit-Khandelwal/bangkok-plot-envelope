/**
 * Bangkok ordinance B.E. 2544 ข้อ 52(6) and ข้อ 53 (DECISIONS.md B12). By default a building on a
 * public road is judged on clause 53 and the 52(6) front open space is for buildings not on one;
 * the stricter reading (`frontOpenSpaceOnPublicRoad`) asks the 52(6) space of every building it
 * lists. A building behind a narrow access (a flag plot) is not on a public road on either reading.
 */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { minDistanceToSegment, shrinkUniform } from '../geom';
import { flagPlot } from '../pipeline/preset-plots';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import type { Design, Pt, Scenario } from '../types';
import { measure } from './context';
import { DEFAULT_READING, frontAccessChecks, OFF_ROAD_READING, STRICT_READING } from './front-access';
import { checkInputFor, floorsOf } from './test-input';

const RULE = 'bma.front-access';

function frontCheck(d: Design) {
  const c = d.checks.find((x) => x.ruleId === RULE);
  if (c === undefined) throw new Error(`no ${RULE} check on ${d.id}`);
  return c;
}

/** The front check for a block inset `insetM` from every boundary, `storeys` high. */
function blockCheck(s: Scenario, insetM: number, storeys: number) {
  const site = expectOk(evaluate(s)).site;
  const plate = shrinkUniform([{ outer: site.ring, holes: [] }], insetM);
  const input = checkInputFor(s, 'lowRise', floorsOf(plate, storeys));
  const [check] = frontAccessChecks(input, measure(input.floors));
  if (check === undefined) throw new Error('no front check');
  return check;
}

const EDGES = [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR];
const SQUARE = scenario(rect(50, 50), EDGES);
const DEEP = scenario(rect(16, 100), EDGES);
const STRICT = { frontOpenSpaceOnPublicRoad: true } as const;

/** A strip `stripM` wide and 25 m long from the road to a 40 x 30 m lot behind it. */
function flag(stripM: number, strict = false): Scenario {
  const h = stripM / 2;
  const pts: Pt[] = [
    { x: -h, y: 0 }, { x: h, y: 0 }, { x: h, y: 25 }, { x: 20, y: 25 }, { x: 20, y: 55 }, { x: -20, y: 55 }, { x: -20, y: 25 }, { x: -h, y: 25 },
  ];
  return scenario(pts, pts.map((_, i) => (i === 0 ? road(8) : NEIGHBOUR)), { frontOpenSpaceOnPublicRoad: strict });
}

describe('front access, default reading: clause 53 on a public road', () => {
  it('passes a 7-storey block 3 m from the road that faces it with over an eighth of its perimeter', () => {
    const c = blockCheck(SQUARE, 3, 7);
    expect(c.status).toBe('pass');
    expect(c.required.startsWith(`Form: on the road. ${DEFAULT_READING}`)).toBe(true);
    expect(c.actual).toBe('The building comes 3 m from the road and has 44 m of façade facing it within 20 m.');
  });

  it('fails a deep block whose road side is under an eighth of its perimeter', () => {
    expect(blockCheck(DEEP, 3, 7).status).toBe('fail');
  });

  it('cites clause 52(6) as our reading', () => {
    const rule = expectOk(evaluate(SQUARE)).regimes.lowRise.rules.rules.find((r) => r.id === RULE);
    expect(rule?.citations.find((c) => c.clause === 'ข้อ 52(6)')?.confidence).toBe('assumption');
  });

  it('keeps the generated block at the road setback, passing', () => {
    const e = expectOk(evaluate(SQUARE));
    const d = designById(e, 'low-rise-block');
    expect(frontCheck(d).status).toBe('pass');
    const edge = e.site.edges[0];
    if (edge === undefined) throw new Error('no edge');
    expect(minDistanceToSegment(d.floors.flatMap((f) => f.outline), edge.from, edge.to)).toBeLessThan(5);
  });

  it('cuts a deep plot with a narrow frontage short so the block meets clause 53', () => {
    const e = expectOk(evaluate(DEEP));
    expect(e.designs.length).toBeGreaterThan(0);
    for (const d of e.designs) expect(frontCheck(d).status).toBe('pass');
  });

  it('places the slender tower in one form or the other, and it meets the clause of that form', () => {
    const e = expectOk(evaluate(scenario(rect(150, 150), [road(30), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    const tower = designById(e, 'slender-tower');
    const c = frontCheck(tower);
    expect(c.status).toBe('pass');
    const edge = e.site.edges[0];
    if (edge === undefined) throw new Error('no edge');
    const gap = minDistanceToSegment(tower.floors.flatMap((f) => f.outline), edge.from, edge.to);
    expect(c.required.startsWith(gap > 20 ? OFF_ROAD_READING : 'Form: on the road.')).toBe(true);
  });
});

describe('front access, stricter reading: clause 52(6) on a public road too', () => {
  it('fails the 7-storey block 3 m from the road: it has no 12 m front open space', () => {
    const c = blockCheck(scenario(rect(50, 50), EDGES, STRICT), 3, 7);
    expect(c.status).toBe('fail');
    expect(c.required.startsWith(`Form: on the road. ${STRICT_READING}`)).toBe(true);
  });

  it('keeps the generated block at least 12 m from the road, passing', () => {
    const e = expectOk(evaluate(scenario(rect(50, 50), EDGES, STRICT)));
    const d = designById(e, 'low-rise-block');
    expect(frontCheck(d).status).toBe('pass');
    const edge = e.site.edges[0];
    if (edge === undefined) throw new Error('no edge');
    expect(minDistanceToSegment(d.floors.flatMap((f) => f.outline), edge.from, edge.to)).toBeGreaterThanOrEqual(12 - 0.02);
  });

  it('judges a building of 2 storeys and 6 m on clause 53 alone', () => {
    expect(blockCheck(scenario(rect(50, 50), EDGES, STRICT), 3, 2).status).toBe('pass');
    expect(blockCheck(scenario(rect(16, 100), EDGES, STRICT), 3, 2).status).toBe('fail');
  });
});

describe('a building behind a narrow access is not on a public road', () => {
  it.each([false, true])('applies clause 52(6) to the flag preset (stricter reading: %s)', (strict) => {
    const e = expectOk(evaluate({ ...flagPlot(), interpretation: { ...flagPlot().interpretation, frontOpenSpaceOnPublicRoad: strict } }));
    expect(e.designs.length).toBeGreaterThan(0);
    for (const d of e.designs) {
      expect(frontCheck(d).status).toBe('pass');
      expect(frontCheck(d).required.startsWith(OFF_ROAD_READING)).toBe(true);
    }
  });

  it('accepts a 9 m access as the link to the road, and not a 5 m one', () => {
    for (const strict of [false, true]) {
      expect(expectOk(evaluate(flag(9, strict))).designs.length).toBeGreaterThan(0);
      expect(expectOk(evaluate(flag(5, strict))).designs).toEqual([]);
    }
  });
});

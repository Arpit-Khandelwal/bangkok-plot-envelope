/**
 * Which roads limit height (MR 55 ข้อ 44 to 46). Expected limits are computed here from the
 * law, 2 x (distance to the plot edge + road width), not from the code under test.
 */
import { describe, expect, it } from 'vitest';
import { runChecks } from '../checks';
import { evaluate } from '../evaluate';
import { heightLimitAt } from '../geom';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import type { OkEvaluation } from '../pipeline/test-scenarios';
import type { Design, EdgeSpec, Pt } from '../types';

const SLOPE = 2;
const TOLERANCE_M = 0.01;

function jogPlot(jog: number): Pt[] {
  return [{ x: 0, y: 0 }, { x: 25, y: 0 }, { x: 25, y: jog }, { x: 50, y: jog }, { x: 50, y: 50 }, { x: 0, y: 50 }];
}
const JOG_EDGES: EdgeSpec[] = [road(12), road(12), road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR];

/** The site frame is centred on the plot; drawn corner 0, the drawn origin, is site corner 0. */
function toSite(e: OkEvaluation, p: Pt): Pt {
  const o = e.site.ring[0] ?? { x: 0, y: 0 };
  return { x: p.x + o.x, y: p.y + o.y };
}

function toDrawn(e: OkEvaluation, p: Pt): Pt {
  const o = e.site.ring[0] ?? { x: 0, y: 0 };
  return { x: p.x - o.x, y: p.y - o.y };
}

function limitAt(e: OkEvaluation, p: Pt): number {
  return heightLimitAt(e.site, e.regimes.highRise.rules.heightPlanes, null, toSite(e, p));
}

describe('a step in a road frontage (item 2)', () => {
  it('ignores a 1 cm jog: 84 m at (45, 30), as on a straight frontage', () => {
    const e = expectOk(evaluate(scenario(jogPlot(0.01), JOG_EDGES)));
    expect(Math.abs(limitAt(e, { x: 45, y: 30 }) - 84)).toBeLessThanOrEqual(0.05);
  });

  it('measures from the stepped frontage at a real 5 m step: 2 x (5 + 12) = 34 m at (40, 10)', () => {
    const e = expectOk(evaluate(scenario(jogPlot(5), JOG_EDGES)));
    expect(limitAt(e, { x: 40, y: 10 })).toBeCloseTo(SLOPE * (5 + 12), 3);
  });

  it('varies continuously as the jog grows from 0 to 1 m', () => {
    const step = 0.05;
    let previous: number | null = null;
    for (let jog = 0; jog <= 1 + 1e-9; jog += step) {
      const points = jog < 0.01 ? [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }] : jogPlot(jog);
      const edges = jog < 0.01 ? [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR] : JOG_EDGES;
      const limit = limitAt(expectOk(evaluate(scenario(points, edges))), { x: 45, y: 30 });
      // The frontage at x = 45 moves back by `jog`, so the limit falls by 2 x jog at most.
      if (previous !== null) expect(Math.abs(limit - previous)).toBeLessThanOrEqual(SLOPE * step + 1e-6);
      previous = limit;
    }
  });
});

interface RoadLine {
  /** Distance from the plot edge into the plot, for a point. */
  readonly depth: (p: Pt) => number;
  readonly rowWidthM: number;
}

function lawLimit(p: Pt, roads: readonly RoadLine[]): number {
  return Math.min(...roads.map((r) => SLOPE * (Math.max(0, r.depth(p)) + r.rowWidthM)));
}

function worstExcess(e: OkEvaluation, design: Design, parapetM: number, roads: readonly RoadLine[]): number {
  let worst = Number.NEGATIVE_INFINITY;
  for (const f of design.floors) {
    for (const poly of f.outline) {
      for (const p of poly.outer) worst = Math.max(worst, f.topM + parapetM - lawLimit(toDrawn(e, p), roads));
    }
  }
  return worst;
}

/** Highest parapet top among floors that reach the area `where` (drawn coordinates). */
function heightReaching(e: OkEvaluation, design: Design, where: (p: Pt) => boolean): number {
  const parapet = design.totals.topHeightM - design.totals.roofDeckHeightM;
  const reaching = design.floors.filter((f) => f.outline.some((poly) => poly.outer.some((p) => where(toDrawn(e, p)))));
  return Math.max(0, ...reaching.map((f) => f.topM + parapet));
}

describe('every road limits height unless the wider-road exception verifiably holds (item 1)', () => {
  it('limits height by the 6 m soi along a 120 m long plot (corner, too long along the soi)', () => {
    const s = scenario(rect(40, 120), [road(30, 'main'), road(6, 'soi'), NEIGHBOUR, NEIGHBOUR], { stationDistanceM: 300 });
    const e = expectOk(evaluate(s));
    const roads: RoadLine[] = [
      { depth: (p) => p.y, rowWidthM: 30 },
      { depth: (p) => 40 - p.x, rowWidthM: 6 },
    ];
    expect(e.designs.length).toBeGreaterThan(0);
    for (const d of e.designs) expect(worstExcess(e, d, s.assumptions.parapetM, roads)).toBeLessThanOrEqual(TOLERANCE_M);
    // Before the fix: high-rise 25.8 m and slender tower 50.4 m to the parapet top.
    // Before the fix the high-rise ran its full 25.8 m to the 6 m building line on the soi (x = 34),
    // where the soi allows 2 x (6 + 6) = 24 m. Now it steps down there.
    expect(heightReaching(e, designById(e, 'high-rise-max'), (p) => p.x >= 33.9)).toBeLessThanOrEqual(24 + TOLERANCE_M);
    const basis = e.regimes.highRise.rules.rules.find((r) => r.id === 'mr55.height-2x')?.basis ?? '';
    expect(basis).toContain('120 m');
    expect(basis).toContain('more than 60 m');
  });

  it('limits height by both roads on a plot 80 m deep between them (opposite sides)', () => {
    const s = scenario(rect(50, 80), [road(30, 'main'), NEIGHBOUR, road(6, 'soi'), NEIGHBOUR], { stationDistanceM: 300 });
    const e = expectOk(evaluate(s));
    const roads: RoadLine[] = [
      { depth: (p) => p.y, rowWidthM: 30 },
      { depth: (p) => 80 - p.y, rowWidthM: 6 },
    ];
    for (const d of e.designs) expect(worstExcess(e, d, s.assumptions.parapetM, roads)).toBeLessThanOrEqual(TOLERANCE_M);
    // Before: 25.8 m at the soi's 6 m building line (y = 74), where the soi allows 24 m.
    expect(heightReaching(e, designById(e, 'high-rise-max'), (p) => p.y >= 73.9)).toBeLessThanOrEqual(24 + TOLERANCE_M);
    const basis = e.regimes.highRise.rules.rules.find((r) => r.id === 'mr55.height-2x')?.basis ?? '';
    expect(basis).toContain('80 m');
  });

  it('lets the 30 m road govern alone at a corner of a plot 50 m long along the soi', () => {
    const e = expectOk(evaluate(scenario(rect(40, 50), [road(30, 'main'), road(6, 'soi'), NEIGHBOUR, NEIGHBOUR])));
    for (const regime of [e.regimes.lowRise, e.regimes.highRise]) {
      const planes = regime.rules.heightPlanes;
      expect(planes.length).toBeGreaterThan(0);
      expect(planes.every((p) => p.edgeIndex === 0 && p.rowWidthM === 30)).toBe(true);
    }
    const basis = e.regimes.highRise.rules.rules.find((r) => r.id === 'mr55.height-2x')?.basis ?? '';
    expect(basis).toContain('corner');
    expect(basis).toContain('50 m');
  });

  it('lets the wider road govern between two roads 50 m apart on a plot 40 m wide', () => {
    const e = expectOk(evaluate(scenario(rect(40, 50), [road(30, 'main'), NEIGHBOUR, road(6, 'soi'), NEIGHBOUR])));
    expect(e.regimes.highRise.rules.heightPlanes.every((p) => p.rowWidthM === 30)).toBe(true);
  });

  it('applies both roads when they are equally wide', () => {
    const e = expectOk(evaluate(scenario(rect(40, 50), [road(12, 'a'), road(12, 'b'), NEIGHBOUR, NEIGHBOUR])));
    expect(new Set(e.regimes.highRise.rules.heightPlanes.map((p) => p.edgeIndex))).toEqual(new Set([0, 1]));
  });
});

describe('the height check decides for itself which roads apply', () => {
  it('fails an over-height design even when handed a height-plane list without the soi', () => {
    const edges: EdgeSpec[] = [road(30, 'main'), road(6, 'soi'), NEIGHBOUR, NEIGHBOUR];
    const two = expectOk(evaluate(scenario(rect(40, 120), edges)));
    // The same plot with the soi drawn as a neighbour: its tower is built as if the soi were not there.
    const one = expectOk(evaluate(scenario(rect(40, 120), [road(30, 'main'), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])));
    const tall = designById(one, 'slender-tower');
    const s = scenario(rect(40, 120), edges);
    const regime = two.regimes.highRise.rules;
    const wrong = { ...regime, heightPlanes: regime.heightPlanes.filter((p) => p.edgeIndex === 0) };
    const checks = runChecks({
      site: two.site,
      regime: wrong,
      floors: tall.floors,
      assumptions: s.assumptions,
      enteredFloorToFloorM: s.assumptions.floorToFloorM,
      buildingType: 'condo',
      zone: s.zone,
      stationDistanceM: s.stationDistanceM,
      reading: { planFarRuleIds: new Set(['plan.far']), parkingCountsInFar: true, parkingCountsInOperatingArea: true },
      disabledRuleIds: new Set(),
    });
    const height = checks.find((c) => c.ruleId === 'mr55.height-2x');
    expect(height?.status).toBe('fail');
    expect(height?.actual).toContain('edge B');
  });
});

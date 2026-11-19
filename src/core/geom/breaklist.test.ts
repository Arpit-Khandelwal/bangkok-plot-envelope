/**
 * Adversarial end-to-end suite: buildSite -> applySetbacks -> buildEnvelope on odd plots.
 * Setbacks and height planes are derived from each edge's spec, the way the rules layer
 * will, so results must not depend on drawing direction or starting corner.
 */
import { describe, expect, it } from 'vitest';
import type { EdgeSetback, EdgeSpec, Envelope, HeightPlane, LngLat, Pt, Region, Site } from '../types';
import { buildEnvelope } from './envelope';
import { metresPerDegree } from './frame';
import { inspectMesh } from './mesh-checks';
import { regionArea } from './region';
import { buildSite } from './site';
import { applySetbacks } from './setbacks';
import { allVertices, P, rotate, setbacksOf, siteFromRing, symDiffArea } from './test-helpers';

const ORIGIN: LngLat = [100.609, 13.689];
const SCALE = metresPerDegree(ORIGIN[1]);
const ll = (x: number, y: number): LngLat => [ORIGIN[0] + x / SCALE.lng, ORIGIN[1] + y / SCALE.lat];
const N: EdgeSpec = { kind: 'neighbour' };
const ROAD: EdgeSpec = { kind: 'road', roadId: 'r', rowWidthM: 10 };

interface Rules {
  readonly roadSetback: number;
  readonly otherSetback: number;
  readonly cap: number | null;
}
const DEFAULT_RULES: Rules = { roadSetback: 6, otherSetback: 2, cap: 60 };

function rulesFor(site: Site, rules: Rules): { setbacks: EdgeSetback[]; planes: HeightPlane[] } {
  const setbacks = site.edges.map((e) => ({
    edgeIndex: e.index,
    distanceM: e.spec.kind === 'road' ? rules.roadSetback : rules.otherSetback,
    ruleId: 't',
  }));
  const planes = site.edges.flatMap((e) =>
    e.spec.kind === 'road' ? [{ edgeIndex: e.index, rowWidthM: e.spec.rowWidthM, slope: 2, ruleId: 't' }] : [],
  );
  return { setbacks, planes };
}

interface Run {
  readonly site: Site;
  readonly footprint: Region;
  readonly envelope: Envelope | null;
}

function checkInvariants(r: Run): void {
  const fpArea = regionArea(r.footprint);
  expect(Number.isFinite(fpArea)).toBe(true);
  expect(fpArea).toBeLessThanOrEqual(r.site.areaM2 + 1e-3);
  for (const v of allVertices(r.footprint)) expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
  if (!r.envelope) return;
  const e = r.envelope;
  expect(Number.isFinite(e.volumeM3) && Number.isFinite(e.maxHeightM)).toBe(true);
  expect(e.volumeM3).toBeGreaterThan(0);
  expect(e.volumeM3).toBeLessThanOrEqual(e.footprintAreaM2 * e.maxHeightM * (1 + 1e-9));
  expect(e.footprintAreaM2).toBeCloseTo(fpArea, 6);
  const m = inspectMesh(e.mesh);
  expect(m.hasNaN).toBe(false);
  expect(m.indicesInRange).toBe(true);
  expect(m.minTriangleArea).toBeGreaterThan(0);
  expect(m.watertight).toBe(true);
  expect(Math.abs(m.signedVolume - e.volumeM3) / e.volumeM3).toBeLessThan(1e-4);
}

function pipeline(site: Site, rules: Rules): Run {
  const { setbacks, planes } = rulesFor(site, rules);
  const footprint = applySetbacks(site, setbacks);
  return { site, footprint, envelope: buildEnvelope(site, footprint, planes, rules.cap) };
}

function runSite(site: Site, rules: Rules = DEFAULT_RULES): Run {
  const run = pipeline(site, rules);
  checkInvariants(run);
  return run;
}

/** buildSite -> applySetbacks -> buildEnvelope with no checks, for timing. */
function timePlot(plot: readonly LngLat[], edges: readonly EdgeSpec[]): number {
  const t0 = performance.now();
  const result = buildSite(plot, edges);
  if (result.ok) pipeline(result.site, DEFAULT_RULES);
  return performance.now() - t0;
}

function runPlot(plot: readonly LngLat[], edges: readonly EdgeSpec[], rules: Rules = DEFAULT_RULES): Run {
  const result = buildSite(plot, edges);
  if (!result.ok) throw new Error(`site rejected: ${result.problems.map((p) => p.code).join(', ')}`);
  return runSite(result.site, rules);
}

/** Same plot from every starting corner and in both windings: same footprint and volume. */
function expectOrderIndependent(plot: readonly LngLat[], edges: readonly EdgeSpec[], rules: Rules = DEFAULT_RULES): Run {
  const base = runPlot(plot, edges, rules);
  const n = plot.length;
  const reversedPlot = [...plot].reverse();
  // Reversed drawing: side i of the reversed plot is original side n-2-i.
  const reversedEdges = edges.map((_, i) => edges[(2 * n - 2 - i) % n] as EdgeSpec);
  const variants: Array<readonly [readonly LngLat[], readonly EdgeSpec[]]> = [[reversedPlot, reversedEdges]];
  for (const k of [1, Math.floor(n / 2), n - 1]) {
    variants.push([rotate(plot, k), rotate(edges, k)], [rotate(reversedPlot, k), rotate(reversedEdges, k)]);
  }
  for (const [p, e] of variants) {
    const r = runPlot(p, e, rules);
    expect(r.site.areaM2).toBeCloseTo(base.site.areaM2, 6);
    expect(symDiffArea(r.footprint, base.footprint)).toBeLessThan(1e-4);
    if (base.envelope) {
      expect(r.envelope).not.toBeNull();
      const dv = Math.abs((r.envelope?.volumeM3 ?? 0) - base.envelope.volumeM3);
      expect(dv / base.envelope.volumeM3).toBeLessThan(1e-9);
      expect(r.envelope?.maxHeightM).toBeCloseTo(base.envelope.maxHeightM, 6);
    } else {
      expect(r.envelope).toBeNull();
    }
  }
  return base;
}

const L_PLOT = [ll(0, 0), ll(40, 0), ll(40, 10), ll(10, 10), ll(10, 30), ll(0, 30)];
const L_EDGES = [ROAD, N, N, N, N, ROAD];

describe('break list', () => {
  it('clockwise and counter-clockwise input give the same result', () => {
    const r = expectOrderIndependent(L_PLOT, L_EDGES);
    expect(r.envelope).not.toBeNull();
  });

  it('self-intersecting bow-tie reports the problem without throwing', () => {
    const r = buildSite([ll(0, 0), ll(30, 30), ll(30, 0), ll(0, 30)], [N, N, N, N]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.map((p) => p.code)).toEqual(['self-intersecting']);
  });

  it('3-point sliver 0.5 m wide and 80 m long', () => {
    const r = buildSite([ll(0, 0), ll(80, 0), ll(40, 0.5)], [ROAD, N, N]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.map((p) => p.code)).toEqual(['too-small']);
    // The geometry itself still copes when fed directly.
    const site = siteFromRing([P(0, 0), P(80, 0), P(40, 0.5)], [ROAD, N, N]);
    expect(runSite(site).envelope).toBeNull();
    const bare = runSite(site, { roadSetback: 0, otherSetback: 0, cap: 10 });
    expect(bare.envelope?.volumeM3).toBeGreaterThan(0);
    expect(runSite(site, { roadSetback: 0.1, otherSetback: 0.1, cap: 10 }).footprint.length).toBeLessThanOrEqual(1);
  });

  // A timing budget only means something without other test files competing for the CPU: run with `pnpm test:perf`.
  it.skipIf(!process.env.PERF_TESTS)('500-vertex circle-like plot runs in under 200 ms', () => {
    const n = 500;
    const plot: LngLat[] = [];
    for (let i = 0; i < n; i++) {
      const t = (2 * Math.PI * i) / n;
      plot.push(ll(45 * Math.cos(t), 45 * Math.sin(t)));
    }
    const edges = plot.map((_, i) => (i < 60 ? ROAD : N));
    const r = runPlot(plot, edges); // checked run, also warms up the JIT
    // Median of five timed runs, so a GC pause or a busy parallel worker does not decide it.
    const times = [0, 1, 2, 3, 4].map(() => timePlot(plot, edges)).sort((a, b) => a - b);
    expect(times[2]).toBeLessThan(200);
    expect(r.envelope).not.toBeNull();
    expect(r.site.areaM2).toBeCloseTo(0.5 * n * 45 * 45 * Math.sin((2 * Math.PI) / n), -1);
  });

  it('very large 300 x 300 m plot', () => {
    const plot = [ll(0, 0), ll(300, 0), ll(300, 300), ll(0, 300)];
    const r = expectOrderIndependent(plot, [ROAD, N, ROAD, N]);
    expect(r.footprint).toHaveLength(1);
    // The test helper maps metres to degrees with one scale, so the plot is a few mm off a
    // true 300 x 300 square: allow about 1 m2 on 85,000.
    expect(Math.abs(regionArea(r.footprint) - 296 * 288)).toBeLessThan(1.5);
  });

  it('collinear points along an edge', () => {
    const plot = [ll(0, 0), ll(10, 0), ll(20, 0), ll(30, 0), ll(30, 25), ll(15, 25), ll(0, 25)];
    const r = expectOrderIndependent(plot, [ROAD, ROAD, ROAD, N, N, N, N]);
    expect(regionArea(r.footprint)).toBeCloseTo(26 * 17, 0);
  });

  it('near-duplicate points 1 mm apart', () => {
    const plot = [ll(0, 0), ll(0.001, 0), ll(30, 0), ll(30, 25), ll(30, 25.001), ll(0, 25)];
    const r = runPlot(plot, [ROAD, ROAD, N, N, N, N]);
    expect(r.site.ring).toHaveLength(4);
    expect(regionArea(r.footprint)).toBeCloseTo(26 * 17, 0);
  });

  it('setbacks of 0 on all edges', () => {
    const r = runPlot(L_PLOT, L_EDGES, { roadSetback: 0, otherSetback: 0, cap: 30 });
    expect(regionArea(r.footprint)).toBeCloseTo(r.site.areaM2, 3);
  });

  it('setback larger than the plot leaves nothing and no envelope', () => {
    const r = runPlot(L_PLOT, L_EDGES, { roadSetback: 100, otherSetback: 2, cap: 30 });
    expect(r.footprint).toEqual([]);
    expect(r.envelope).toBeNull();
  });

  it('narrow 3 m neck between two lobes splits under 2 m setbacks', () => {
    const plot = [
      ll(0, 0), ll(25, 0), ll(25, 20), ll(14, 20), ll(14, 26), ll(25, 26),
      ll(25, 46), ll(0, 46), ll(0, 26), ll(11, 26), ll(11, 20), ll(0, 20),
    ];
    const edges = plot.map((_, i) => (i === 0 ? ROAD : N));
    const r = expectOrderIndependent(plot, edges);
    expect(r.footprint).toHaveLength(2);
    expect(r.envelope).not.toBeNull();
  });

  it('works on lng/lat around (100.609, 13.689) and keeps setback distances', () => {
    const r = runPlot(L_PLOT, L_EDGES);
    expect(Math.abs(r.site.frame.origin[0] - 100.609)).toBeLessThan(0.001);
    expect(r.site.areaM2).toBeCloseTo(600, 0);
    // The whole pipeline respects every setback (mm snapping tolerance).
    const { setbacks } = rulesFor(r.site, DEFAULT_RULES);
    const ring = r.site.ring;
    for (const v of allVertices(r.footprint)) {
      for (const s of setbacks) {
        const a = ring[s.edgeIndex] as Pt;
        const b = ring[(s.edgeIndex + 1) % ring.length] as Pt;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((v.x - a.x) * dx + (v.y - a.y) * dy) / (dx * dx + dy * dy)));
        expect(Math.hypot(v.x - a.x - t * dx, v.y - a.y - t * dy)).toBeGreaterThanOrEqual(s.distanceM - 0.001);
      }
    }
  });

  it('degenerate and hostile inputs never throw', () => {
    const site = siteFromRing([P(0, 0), P(30, 0), P(30, 20), P(0, 20)]);
    expect(() => applySetbacks(site, setbacksOf([Number.NaN, -5, Infinity, 1e9]))).not.toThrow();
    expect(() => buildEnvelope(site, [], [], null)).not.toThrow();
    expect(() => buildSite([], [])).not.toThrow();
    expect(() => buildSite([ll(0, 0), ll(0, 0), ll(0, 0), ll(0, 0)], [N, N, N, N])).not.toThrow();
    const spike = buildSite([ll(0, 0), ll(30, 0), ll(30, 20), ll(30, 10), ll(0, 20)], [N, N, N, N, N]);
    expect(spike.ok).toBe(false);
  });
});

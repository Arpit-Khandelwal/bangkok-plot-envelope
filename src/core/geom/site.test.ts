import { describe, expect, it } from 'vitest';
import type { EdgeSpec, LngLat, Pt, Site } from '../types';
import { metresPerDegree } from './frame';
import { buildSite } from './site';

const ORIGIN: LngLat = [100.609, 13.689];
const SCALE = metresPerDegree(ORIGIN[1]);
/** Local metres (approximately) to lng/lat around the test origin. */
const ll = (x: number, y: number): LngLat => [ORIGIN[0] + x / SCALE.lng, ORIGIN[1] + y / SCALE.lat];

const N: EdgeSpec = { kind: 'neighbour' };
const ROAD: EdgeSpec = { kind: 'road', roadId: 'soi-1', rowWidthM: 10 };
const WATER: EdgeSpec = { kind: 'waterway', widthM: 6 };

/** L-shaped plot, CCW: 40 m along the south side, 10 m wide arms, 30 m tall. Area 600 m2. */
const L_CCW: LngLat[] = [ll(0, 0), ll(40, 0), ll(40, 10), ll(10, 10), ll(10, 30), ll(0, 30)];
/** The road is the south side (corner 0 -> corner 1); the waterway is the east end. */
const L_CCW_EDGES: EdgeSpec[] = [ROAD, WATER, N, N, N, N];

function ok(result: ReturnType<typeof buildSite>): Site {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.problems)}`);
  return result.site;
}

function codes(result: ReturnType<typeof buildSite>): string[] {
  return result.ok ? [] : result.problems.map((p) => p.code);
}

/** The edge whose endpoints are (approximately) the given local points, in either order. */
function edgeBetween(site: Site, a: Pt, b: Pt): EdgeSpec | undefined {
  const near = (p: Pt, q: Pt): boolean => Math.hypot(p.x - q.x, p.y - q.y) < 0.05;
  // Ring is centred on the centroid of the corners; shift the probes accordingly.
  return site.edges.find((e) => (near(e.from, a) && near(e.to, b)) || (near(e.from, b) && near(e.to, a)))?.spec;
}

describe('buildSite', () => {
  it('accepts a counter-clockwise L-shape', () => {
    const site = ok(buildSite(L_CCW, L_CCW_EDGES));
    expect(site.ring).toHaveLength(6);
    expect(site.areaM2).toBeCloseTo(600, 1);
    expect(site.perimeterM).toBeCloseTo(140, 1);
    expect(site.edges.map((e) => e.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(site.edges[0]?.lengthM).toBeCloseTo(40, 1);
  });

  it('reverses a clockwise plot and keeps each spec on the same physical edge', () => {
    const ccw = ok(buildSite(L_CCW, L_CCW_EDGES));
    // Same plot drawn clockwise, starting from a different corner. Edge i of the clockwise
    // drawing runs from cw[i] to cw[i+1], so the specs are listed for those sides.
    const cw: LngLat[] = [ll(40, 10), ll(40, 0), ll(0, 0), ll(0, 30), ll(10, 30), ll(10, 10)];
    const cwEdges: EdgeSpec[] = [WATER, ROAD, N, N, N, N];
    const site = ok(buildSite(cw, cwEdges));
    expect(site.areaM2).toBeCloseTo(ccw.areaM2, 6);
    // The ring is CCW: positive signed area.
    let s = 0;
    for (let i = 0; i < site.ring.length; i++) {
      const p = site.ring[i] as Pt;
      const q = site.ring[(i + 1) % site.ring.length] as Pt;
      s += p.x * q.y - q.x * p.y;
    }
    expect(s).toBeGreaterThan(0);
    // Find the physical south side and east end by coordinates in each site.
    const sw = ccw.ring[0] as Pt;
    const se = ccw.ring[1] as Pt;
    const ne = ccw.ring[2] as Pt;
    const shift = (p: Pt): Pt => {
      // Both sites use the same corner set, hence the same centroid frame.
      expect(site.frame.origin[0]).toBeCloseTo(ccw.frame.origin[0], 12);
      return p;
    };
    expect(edgeBetween(site, shift(sw), shift(se))).toEqual(ROAD);
    expect(edgeBetween(site, shift(se), shift(ne))).toEqual(WATER);
    expect(site.edges.filter((e) => e.spec.kind === 'road')).toHaveLength(1);
    // Every edge's spec is the one the clockwise drawing gave that physical side.
    for (const e of site.edges) {
      const isSouth = Math.abs(e.from.y - sw.y) < 0.05 && Math.abs(e.to.y - sw.y) < 0.05;
      const isEast = Math.abs(e.from.x - se.x) < 0.05 && Math.abs(e.to.x - se.x) < 0.05;
      expect(e.spec).toEqual(isSouth ? ROAD : isEast ? WATER : N);
    }
  });

  it('remaps a clockwise triangle edge by edge', () => {
    const a = ll(0, 0);
    const b = ll(0, 20);
    const c = ll(20, 0);
    // Clockwise a -> b -> c. Sides: ab, bc, ca, each with a distinct road id.
    const spec = (id: string): EdgeSpec => ({ kind: 'road', roadId: id, rowWidthM: 8 });
    const site = ok(buildSite([a, b, c], [spec('ab'), spec('bc'), spec('ca')]));
    const pa = site.ring[0] as Pt;
    for (const e of site.edges) {
      if (e.spec.kind !== 'road') throw new Error('expected road');
      const touchesA = [e.from, e.to].some((p) => Math.hypot(p.x - pa.x, p.y - pa.y) < 1e-6);
      if (e.spec.roadId === 'bc') expect(touchesA).toBe(false);
      else expect(touchesA).toBe(true);
    }
  });

  it('merges near-duplicate corners and drops the zero-length side', () => {
    const plot: LngLat[] = [ll(0, 0), ll(0.004, 0), ll(30, 0), ll(30, 30), ll(0, 30), ll(0, 0.003)];
    const specs: EdgeSpec[] = [N, ROAD, N, N, N, N];
    const site = ok(buildSite(plot, specs));
    expect(site.ring).toHaveLength(4);
    // The side from (0,0) to (30,0) kept its road spec.
    expect(site.edges.filter((e) => e.spec.kind === 'road')).toHaveLength(1);
    const road = site.edges.find((e) => e.spec.kind === 'road');
    expect(road?.lengthM).toBeCloseTo(30, 1);
    expect(Math.abs((road?.from.y ?? 0) - (road?.to.y ?? 1))).toBeLessThan(0.01);
  });

  it('handles a closing point that repeats the first', () => {
    const plot: LngLat[] = [ll(0, 0), ll(30, 0), ll(30, 30), ll(0, 30), ll(0, 0)];
    const specs: EdgeSpec[] = [ROAD, N, N, WATER, N];
    const site = ok(buildSite(plot, specs));
    expect(site.ring).toHaveLength(4);
    expect(site.edges.map((e) => e.spec.kind)).toEqual(['road', 'neighbour', 'neighbour', 'waterway']);
  });

  it('keeps collinear corners and their specs', () => {
    const plot: LngLat[] = [ll(0, 0), ll(15, 0), ll(30, 0), ll(30, 30), ll(0, 30)];
    const site = ok(buildSite(plot, [ROAD, ROAD, N, N, N]));
    expect(site.ring).toHaveLength(5);
    expect(site.areaM2).toBeCloseTo(900, 1);
  });

  it('reports the documented problems with plain-language messages', () => {
    expect(codes(buildSite([ll(0, 0), ll(1, 1)], [N, N]))).toEqual(['too-few-points']);
    expect(codes(buildSite([ll(0, 0), ll(0, 0), ll(0, 0.001)], [N, N, N]))).toEqual(['too-few-points']);
    expect(codes(buildSite(L_CCW, [N, N]))).toEqual(['edges-mismatch']);
    const bowtie = [ll(0, 0), ll(20, 20), ll(20, 0), ll(0, 20)];
    const r = buildSite(bowtie, [N, N, N, N]);
    expect(codes(r)).toEqual(['self-intersecting']);
    if (!r.ok) {
      expect(r.problems[0]?.message).toMatch(/crosses/);
      expect(r.problems[0]?.blocking).toBe(true);
    }
    expect(codes(buildSite([ll(0, 0), ll(10, 0), ll(20, 0)], [N, N, N]))).toEqual(['zero-area']);
    expect(codes(buildSite([ll(0, 0), ll(5, 0), ll(5, 5), ll(0, 5)], [N, N, N, N]))).toEqual(['too-small']);
    expect(codes(buildSite([ll(0, 0), ll(700, 0), ll(700, 700), ll(0, 700)], [N, N, N, N]))).toEqual(['too-large']);
    expect(codes(buildSite([ll(0, 0), [Number.NaN, 13], ll(0, 10)], [N, N, N]))).toEqual(['too-few-points']);
  });

  it('mentions the area in too-small and too-large messages', () => {
    const r = buildSite([ll(0, 0), ll(5, 0), ll(5, 5), ll(0, 5)], [N, N, N, N]);
    expect(r.ok ? '' : r.problems[0]?.message).toMatch(/25 m²/);
  });

  it('rejects a plot that touches itself', () => {
    // Corner (15, 0.0) of the notch sits on the south side.
    const touching = [ll(0, 0), ll(30, 0), ll(30, 30), ll(15, 0), ll(0, 30)];
    expect(codes(buildSite(touching, [N, N, N, N, N]))).toEqual(['self-intersecting']);
  });

  it('does not mutate its inputs', () => {
    const plot = [...L_CCW];
    const specs = [...L_CCW_EDGES];
    const before = JSON.stringify([plot, specs]);
    buildSite([...plot].reverse(), specs);
    expect(JSON.stringify([plot, specs])).toBe(before);
  });
});

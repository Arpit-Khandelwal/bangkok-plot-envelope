import { describe, expect, it } from 'vitest';
import type { Pt, Region } from '../types';
import { regionArea } from './region';
import { distanceToSegment } from './ring';
import { applySetbacks, setbackDistances } from './setbacks';
import { allVertices, P, rectRing, rotate, setbacksOf, siteFromRing, symDiffArea } from './test-helpers';
import { ARC_TOLERANCE_M } from './tolerance';

/** Snapping to the 1 mm grid moves a vertex by at most half a millimetre per axis. */
const SNAP_M = 0.001;

function assertSetbacksHold(ring: readonly Pt[], d: readonly number[], result: Region): void {
  for (const v of allVertices(result)) {
    for (let i = 0; i < ring.length; i++) {
      const di = d[i] ?? 0;
      if (di <= 0) continue;
      const dist = distanceToSegment(v, ring[i] as Pt, ring[(i + 1) % ring.length] as Pt);
      expect(dist).toBeGreaterThanOrEqual(di - SNAP_M);
    }
  }
}

const L_RING = [P(0, 0), P(40, 0), P(40, 10), P(10, 10), P(10, 30), P(0, 30)];

describe('applySetbacks', () => {
  it('rectangle 40 x 30 with setbacks 6, 2, 2, 2', () => {
    const site = siteFromRing(rectRing(40, 30));
    const r = applySetbacks(site, setbacksOf([6, 2, 2, 2]));
    expect(r).toHaveLength(1);
    expect(regionArea(r)).toBeCloseTo((40 - 2 - 2) * (30 - 6 - 2), 6);
    assertSetbacksHold(site.ring, [6, 2, 2, 2], r);
  });

  it('rectangle with four different setbacks', () => {
    const site = siteFromRing(rectRing(40, 30));
    const d = [6, 3, 1.5, 4.25];
    const r = applySetbacks(site, setbacksOf(d));
    // Bottom 6, right 3, top 1.5, left 4.25.
    expect(regionArea(r)).toBeCloseTo((40 - 3 - 4.25) * (30 - 6 - 1.5), 6);
    assertSetbacksHold(site.ring, d, r);
  });

  it('no setbacks returns the plot', () => {
    const site = siteFromRing(rectRing(40, 30));
    expect(regionArea(applySetbacks(site, []))).toBeCloseTo(1200, 9);
    expect(regionArea(applySetbacks(site, setbacksOf([0, 0, 0, 0])))).toBeCloseTo(1200, 9);
  });

  it('L-shape: uniform setback rounds the reflex corner', () => {
    const site = siteFromRing(L_RING);
    const d = [2, 2, 2, 2, 2, 2];
    const r = applySetbacks(site, setbacksOf(d));
    // Uniform 2 m inset of an L with 10 m arms: 36x6 + 6x20 + reflex fillet (4 - pi).
    const exact = 36 * 6 + 6 * 20 + (4 - Math.PI);
    expect(regionArea(r)).toBeLessThanOrEqual(exact + 1e-6);
    expect(exact - regionArea(r)).toBeLessThan(0.05);
    assertSetbacksHold(site.ring, d, r);
  });

  it('L-shape with mixed setbacks keeps the distance rule at every vertex', () => {
    const site = siteFromRing(L_RING);
    const d = [6, 0, 3, 4, 1, 2];
    const r = applySetbacks(site, setbacksOf(d));
    expect(regionArea(r)).toBeGreaterThan(0);
    assertSetbacksHold(site.ring, d, r);
  });

  it('thin triangle', () => {
    const ring = [P(0, 0), P(60, 0), P(0, 8)];
    const site = siteFromRing(ring);
    const r = applySetbacks(site, setbacksOf([1, 1, 1]));
    expect(regionArea(r)).toBeGreaterThan(0);
    expect(regionArea(r)).toBeLessThan(240);
    assertSetbacksHold(ring, [1, 1, 1], r);
    // Inradius is about 3.97 m, so a 4 m setback leaves nothing.
    expect(applySetbacks(site, setbacksOf([4, 4, 4]))).toEqual([]);
  });

  it('setbacks that consume everything give an empty region', () => {
    const site = siteFromRing(rectRing(20, 10));
    expect(applySetbacks(site, setbacksOf([5, 5, 5, 5]))).toEqual([]);
    expect(applySetbacks(site, setbacksOf([100, 0, 0, 0]))).toEqual([]);
    expect(applySetbacks(site, setbacksOf([Infinity, 0, 0, 0]))).toEqual([]);
  });

  it('hourglass plot splits into two pieces', () => {
    // Two 20 x 20 lobes joined by a 4 m waist.
    const ring = [P(0, 0), P(20, 0), P(20, 20), P(12, 20), P(12, 24), P(20, 24), P(20, 44), P(0, 44), P(0, 24), P(8, 24), P(8, 20), P(0, 20)];
    const site = siteFromRing(ring);
    expect(site.areaM2).toBeGreaterThan(0);
    const d = ring.map(() => 2.5);
    const r = applySetbacks(site, setbacksOf(d));
    expect(r).toHaveLength(2);
    assertSetbacksHold(ring, d, r);
  });

  it('property: every vertex respects every edge setback on assorted plots', () => {
    const plots: Pt[][] = [
      rectRing(40, 30),
      L_RING,
      [P(0, 0), P(30, -5), P(50, 10), P(35, 12), P(40, 30), P(10, 25), P(15, 12)],
      [P(0, 0), P(25, 0), P(25, 25), P(20, 25), P(20, 5), P(5, 5), P(5, 25), P(0, 25)],
    ];
    const pattern = [6, 0, 2, 3.5, 1, 4.2, 0.5, 2];
    for (const ring of plots) {
      const d = ring.map((_, i) => pattern[i % pattern.length] as number);
      const r = applySetbacks(siteFromRing(ring), setbacksOf(d));
      assertSetbacksHold(ring, d, r);
      // And the result is not overly conservative: rounding of arcs costs < perimeter x tol.
      const loose = applySetbacks(
        siteFromRing(ring),
        setbacksOf(d.map((x) => Math.max(0, x - ARC_TOLERANCE_M))),
      );
      expect(regionArea(loose)).toBeGreaterThanOrEqual(regionArea(r));
    }
  });

  it('gives the same footprint whichever corner the plot starts from', () => {
    const d = [6, 0, 3, 4, 1, 2];
    const base = applySetbacks(siteFromRing(L_RING), setbacksOf(d));
    for (let k = 1; k < L_RING.length; k++) {
      const r = applySetbacks(siteFromRing(rotate(L_RING, k)), setbacksOf(rotate(d, k)));
      expect(symDiffArea(base, r)).toBeLessThan(1e-6);
      expect(regionArea(r)).toBeCloseTo(regionArea(base), 9);
    }
  });

  it('takes the largest of repeated entries and ignores invalid ones', () => {
    const site = siteFromRing(rectRing(40, 30));
    const d = setbackDistances(site, [
      { edgeIndex: 0, distanceM: 2, ruleId: 'a' },
      { edgeIndex: 0, distanceM: 6, ruleId: 'b' },
      { edgeIndex: 1, distanceM: -3, ruleId: 'c' },
      { edgeIndex: 2, distanceM: Number.NaN, ruleId: 'd' },
      { edgeIndex: 9, distanceM: 4, ruleId: 'e' },
      { edgeIndex: 1.5, distanceM: 4, ruleId: 'f' },
    ]);
    expect(d).toEqual([6, 0, 0, 0]);
  });

  it('does not mutate the site', () => {
    const site = siteFromRing(L_RING);
    const before = JSON.stringify(site);
    applySetbacks(site, setbacksOf([6, 0, 3, 4, 1, 2]));
    expect(JSON.stringify(site)).toBe(before);
  });
});

import { describe, expect, it } from 'vitest';
import type { Envelope, HeightPlane, Region, Site } from '../types';
import { buildEnvelope } from './envelope';
import { heightLimitAt } from './height';
import { inspectMesh } from './mesh-checks';
import { pointInRegion, regionArea, regionBounds } from './region';
import { applySetbacks } from './setbacks';
import { P, rectRing, setbacksOf, siteFromRing } from './test-helpers';

const rectSite = siteFromRing(rectRing(40, 30));
const south: HeightPlane = { edgeIndex: 0, rowWidthM: 10, slope: 2, ruleId: 'h' };
const east: HeightPlane = { edgeIndex: 1, rowWidthM: 4, slope: 2, ruleId: 'h' };
const L_RING = [P(0, 0), P(40, 0), P(40, 10), P(10, 10), P(10, 30), P(0, 30)];
const lSite = siteFromRing(L_RING);

function must(e: Envelope | null): Envelope {
  if (!e) throw new Error('expected an envelope');
  return e;
}

/**
 * Midpoint-rule integral of the height limit over the region, as an independent check.
 * Rescaled by exact area / sampled area so boundary sampling noise does not dominate.
 */
function numericVolume(site: Site, region: Region, planes: HeightPlane[], cap: number | null, n = 400): number {
  const b = regionBounds(region);
  if (!b) return 0;
  const dx = (b.maxX - b.minX) / n;
  const dy = (b.maxY - b.minY) / n;
  let v = 0;
  let a = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const p = P(b.minX + (i + 0.5) * dx, b.minY + (j + 0.5) * dy);
      if (!pointInRegion(p, region)) continue;
      v += heightLimitAt(site, planes, cap, p) * dx * dy;
      a += dx * dy;
    }
  }
  return a > 0 ? (v * regionArea(region)) / a : 0;
}

function expectSoundMesh(e: Envelope): void {
  const r = inspectMesh(e.mesh);
  expect(r.hasNaN).toBe(false);
  expect(r.indicesInRange).toBe(true);
  expect(r.minTriangleArea).toBeGreaterThan(1e-9);
  expect(r.watertight).toBe(true);
  // The closed mesh's own volume agrees with the computed integral (float32 positions).
  expect(Math.abs(r.signedVolume - e.volumeM3) / e.volumeM3).toBeLessThan(1e-5);
}

describe('buildEnvelope', () => {
  const fp = applySetbacks(rectSite, setbacksOf([6, 2, 2, 2])); // x 2..38, y 6..28

  it('flat cap only: volume = area x cap', () => {
    const e = must(buildEnvelope(rectSite, fp, [], 20));
    expect(e.footprintAreaM2).toBeCloseTo(792, 6);
    expect(e.volumeM3).toBeCloseTo(792 * 20, 4);
    expect(e.maxHeightM).toBe(20);
    expectSoundMesh(e);
  });

  it('single plane: a wedge on a box', () => {
    // H = 2 (y + 10); volume = 36 * [(y + 10)^2] from 6 to 28 = 36 * (38^2 - 16^2).
    const e = must(buildEnvelope(rectSite, fp, [south], null));
    expect(e.volumeM3).toBeCloseTo(36 * (38 * 38 - 16 * 16), 3);
    expect(e.maxHeightM).toBeCloseTo(76, 6);
    expectSoundMesh(e);
  });

  it('plane plus a cap that cuts in partway', () => {
    // min(2 (y + 10), 50): sloped from y = 6 to 15, flat 50 from 15 to 28.
    const e = must(buildEnvelope(rectSite, fp, [south], 50));
    expect(e.volumeM3).toBeCloseTo(36 * (25 * 25 - 16 * 16 + 50 * 13), 3);
    expect(e.maxHeightM).toBeCloseTo(50, 9);
    expectSoundMesh(e);
  });

  it('two road planes: the lower governs, matching numeric integration', () => {
    const e = must(buildEnvelope(rectSite, fp, [south, east], 60));
    expect(Math.abs(e.volumeM3 - numericVolume(rectSite, fp, [south, east], 60)) / e.volumeM3).toBeLessThan(1e-3);
    expectSoundMesh(e);
  });

  it('identical planes from collinear road edges do not double count', () => {
    const ring = [P(0, 0), P(20, 0), P(40, 0), P(40, 30), P(0, 30)];
    const site = siteFromRing(ring);
    const planes = [0, 1].map((edgeIndex) => ({ ...south, edgeIndex }));
    const e = must(buildEnvelope(site, [{ outer: ring, holes: [] }], planes, null));
    expect(e.volumeM3).toBeCloseTo(40 * (40 * 40 - 10 * 10), 3);
    expectSoundMesh(e);
  });

  it('L-shape (concave): watertight, and the clamp applies beyond the road line', () => {
    // Road on the inner edge x = 10 (edge 3): the long arm lies beyond that line.
    const road: HeightPlane = { edgeIndex: 3, rowWidthM: 8, slope: 2, ruleId: 'h' };
    const full: Region = [{ outer: L_RING, holes: [] }];
    const e = must(buildEnvelope(lSite, full, [road], 40));
    expect(Math.abs(e.volumeM3 - numericVolume(lSite, full, [road], 40)) / e.volumeM3).toBeLessThan(1e-3);
    expectSoundMesh(e);
    // Beyond the line the limit is slope x row = 16.
    expect(heightLimitAt(lSite, [road], 40, P(30, 5))).toBe(16);
  });

  it('concave footprint after setbacks, with two planes and a cap', () => {
    const fpL = applySetbacks(lSite, setbacksOf([6, 2, 3, 3, 2, 2]));
    const planes: HeightPlane[] = [
      { edgeIndex: 0, rowWidthM: 12, slope: 2, ruleId: 'a' },
      { edgeIndex: 4, rowWidthM: 6, slope: 2, ruleId: 'b' },
    ];
    const e = must(buildEnvelope(lSite, fpL, planes, 45));
    expect(e.footprintAreaM2).toBeCloseTo(regionArea(fpL), 9);
    expect(Math.abs(e.volumeM3 - numericVolume(lSite, fpL, planes, 45)) / e.volumeM3).toBeLessThan(2e-3);
    expect(e.volumeM3).toBeLessThanOrEqual(e.footprintAreaM2 * e.maxHeightM);
    expectSoundMesh(e);
  });

  it('handles footprints with holes and several pieces', () => {
    const donut: Region = [
      { outer: rectRing(30, 30, 5, 0), holes: [[P(15, 10), P(15, 20), P(25, 20), P(25, 10)]] },
      { outer: rectRing(4, 4, 36, 26), holes: [] },
    ];
    const e = must(buildEnvelope(rectSite, donut, [south, east], 50));
    expect(Math.abs(e.volumeM3 - numericVolume(rectSite, donut, [south, east], 50)) / e.volumeM3).toBeLessThan(2e-3);
    expectSoundMesh(e);
  });

  it('returns null for nothing to build', () => {
    expect(buildEnvelope(rectSite, [], [south], 20)).toBeNull();
    expect(buildEnvelope(rectSite, fp, [], null)).toBeNull();
    expect(buildEnvelope(rectSite, fp, [south], 0)).toBeNull();
    expect(buildEnvelope(rectSite, fp, [south], Number.NaN)).toBeNull();
    expect(buildEnvelope(rectSite, fp, [{ ...south, edgeIndex: 9 }], 20)).toBeNull();
    expect(buildEnvelope(rectSite, fp, [{ ...south, slope: -2 }], 20)).toBeNull();
  });

  it('meets the ground cleanly where the limit is zero', () => {
    // Zero right-of-way and no setback: the limit is 0 along the road edge itself.
    const full: Region = [{ outer: rectRing(40, 30), holes: [] }];
    const e = must(buildEnvelope(rectSite, full, [{ ...south, rowWidthM: 0 }], null));
    expect(e.volumeM3).toBeCloseTo(40 * 30 * 30, 3);
    expectSoundMesh(e);
  });

  it('property: closed mesh and exact volume on assorted concave plots and plane mixes', () => {
    // Deterministic pseudo-random choices (seeded LCG) so failures are reproducible.
    let seed = 12345;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const plots = [
      L_RING,
      [P(0, 0), P(30, -5), P(50, 10), P(35, 12), P(40, 30), P(10, 25), P(15, 12)],
      [P(0, 0), P(25, 0), P(25, 25), P(20, 25), P(20, 5), P(5, 5), P(5, 25), P(0, 25)],
      [P(0, 0), P(60, 0), P(0, 8)],
    ];
    for (const ring of plots) {
      const site = siteFromRing(ring);
      for (let trial = 0; trial < 4; trial++) {
        const planes: HeightPlane[] = ring
          .map((_, i) => i)
          .filter(() => rnd() < 0.5)
          .map((edgeIndex) => ({ edgeIndex, rowWidthM: 4 + 20 * rnd(), slope: 1 + 2 * rnd(), ruleId: 'p' }));
        const cap = rnd() < 0.3 ? null : 10 + 50 * rnd();
        if (planes.length === 0 && cap === null) continue;
        const d = ring.map(() => (rnd() < 0.5 ? 0 : 3 * rnd()));
        const fpR = applySetbacks(site, setbacksOf(d));
        const e = buildEnvelope(site, fpR, planes, cap);
        if (!e) {
          expect(fpR).toEqual([]);
          continue;
        }
        expectSoundMesh(e);
        const num = numericVolume(site, e.footprint, planes, cap, 300);
        expect(Math.abs(e.volumeM3 - num) / e.volumeM3).toBeLessThan(3e-3);
        expect(e.volumeM3).toBeLessThanOrEqual(e.footprintAreaM2 * e.maxHeightM * (1 + 1e-9));
      }
    }
  });

  it('does not mutate inputs', () => {
    const planes = [south, east];
    const before = JSON.stringify([rectSite, fp, planes]);
    buildEnvelope(rectSite, fp, planes, 30);
    expect(JSON.stringify([rectSite, fp, planes])).toBe(before);
  });
});

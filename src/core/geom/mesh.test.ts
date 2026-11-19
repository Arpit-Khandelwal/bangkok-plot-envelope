import { describe, expect, it } from 'vitest';
import type { Polygon, Region } from '../types';
import { extrudeRegion, mergeMeshes } from './mesh';
import { inspectMesh } from './mesh-checks';
import { P, rectRing } from './test-helpers';

const rect = (w: number, h: number, x0 = 0, y0 = 0): Polygon => ({ outer: rectRing(w, h, x0, y0), holes: [] });

function expectClosed(region: Region, base: number, top: number, area: number): void {
  const m = extrudeRegion(region, base, top);
  const r = inspectMesh(m);
  expect(r.hasNaN).toBe(false);
  expect(r.indicesInRange).toBe(true);
  expect(r.minTriangleArea).toBeGreaterThan(1e-9);
  expect(r.watertight).toBe(true);
  expect(r.signedVolume).toBeCloseTo(area * (top - base), 3);
}

describe('extrudeRegion', () => {
  it('makes a closed box', () => {
    expectClosed([rect(10, 5)], 0, 3, 50);
    const m = extrudeRegion([rect(10, 5)], 0, 3);
    expect(m.positions.length / 3).toBe(8);
    expect(m.indices.length / 3).toBe(12);
    // Holes and islands: an island inside a hole of a donut.
    const island: Region = [
      { outer: rectRing(10, 10), holes: [[P(2, 2), P(2, 8), P(8, 8), P(8, 2)]] },
      { outer: rectRing(2, 2, 4, 4), holes: [] },
    ];
    expectClosed(island, 0, 1, 64 + 4);
  });

  it('handles holes, several pieces, raised bases and collinear corners', () => {
    const donut: Polygon = { outer: rectRing(10, 10), holes: [[P(3, 3), P(3, 7), P(7, 7), P(7, 3)]] };
    expectClosed([donut], 0, 4, 84);
    expectClosed([rect(4, 4), rect(5, 5, 10, 0)], 6, 9, 41);
    expectClosed([{ outer: [P(0, 0), P(5, 0), P(10, 0), P(10, 10), P(0, 10), P(0, 5)], holes: [] }], 0, 2, 100);
    const L: Polygon = { outer: [P(0, 0), P(40, 0), P(40, 10), P(10, 10), P(10, 30), P(0, 30)], holes: [] };
    expectClosed([L], 3, 6.5, 600);
  });

  it('is empty for empty input or non-positive height', () => {
    expect(extrudeRegion([], 0, 3).indices.length).toBe(0);
    expect(extrudeRegion([rect(1, 1)], 3, 3).indices.length).toBe(0);
    expect(extrudeRegion([rect(1, 1)], 3, Number.NaN).indices.length).toBe(0);
  });
});

describe('mergeMeshes', () => {
  it('concatenates and offsets indices', () => {
    const a = extrudeRegion([rect(2, 2)], 0, 1);
    const b = extrudeRegion([rect(2, 2, 5, 5)], 0, 2);
    const m = mergeMeshes([a, b]);
    expect(m.positions.length).toBe(a.positions.length + b.positions.length);
    expect(m.indices.length).toBe(a.indices.length + b.indices.length);
    const r = inspectMesh(m);
    expect(r.watertight).toBe(true);
    expect(r.signedVolume).toBeCloseTo(4 + 8, 4);
    expect(mergeMeshes([]).indices.length).toBe(0);
  });
});

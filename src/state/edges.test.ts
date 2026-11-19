import { describe, expect, test } from 'vitest';
import type { EdgeSpec, LngLat } from '../core/types';
import { neighbourEdges, remapEdges } from './edges';

const A: LngLat = [100.6, 13.69];
const B: LngLat = [100.601, 13.69];
const C: LngLat = [100.601, 13.691];
const D: LngLat = [100.6, 13.691];
const ROAD: EdgeSpec = { kind: 'road', roadId: 'r1', rowWidthM: 12 };
const NEIGHBOUR: EdgeSpec = { kind: 'neighbour' };

describe('remapEdges', () => {
  test('keeps every setting when a corner is dragged', () => {
    const moved: LngLat = [100.6012, 13.6899];

    const result = remapEdges([A, B, C, D], [ROAD, NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], [A, moved, C, D]);

    expect(result).toEqual([ROAD, NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]);
  });

  test('gives both halves the road setting when the road edge is split', () => {
    const midpoint: LngLat = [100.6005, 13.69];

    const result = remapEdges([A, B, C, D], [ROAD, NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], [A, midpoint, B, C, D]);

    expect(result).toEqual([ROAD, ROAD, NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]);
  });

  test('splits the closing edge when a corner is added after the last one', () => {
    const midpoint: LngLat = [100.6, 13.6905];

    const result = remapEdges([A, B, C, D], [NEIGHBOUR, NEIGHBOUR, NEIGHBOUR, ROAD], [A, B, C, D, midpoint]);

    expect(result).toEqual([NEIGHBOUR, NEIGHBOUR, NEIGHBOUR, ROAD, ROAD]);
  });

  test('keeps the first edge setting when a corner is deleted', () => {
    const result = remapEdges([A, B, C, D], [ROAD, NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], [A, C, D]);

    expect(result).toEqual([ROAD, NEIGHBOUR, NEIGHBOUR]);
  });

  test('keeps a road on the last edge when the first corner is deleted', () => {
    const result = remapEdges([A, B, C, D], [NEIGHBOUR, NEIGHBOUR, NEIGHBOUR, ROAD], [B, C, D]);

    expect(result).toEqual([NEIGHBOUR, NEIGHBOUR, ROAD]);
  });

  test('resets to neighbour boundaries for an unrelated plot', () => {
    const result = remapEdges([A, B, C], [ROAD, NEIGHBOUR, NEIGHBOUR], [A, B, C, D, A, B]);

    expect(result).toEqual(neighbourEdges(6));
  });

  test('resets when the previous settings do not match the previous plot', () => {
    const result = remapEdges([A, B, C, D], [ROAD], [A, B, C, D]);

    expect(result).toEqual(neighbourEdges(4));
  });

  describe('the same polygon handed back in another order', () => {
    // Square A-B-C-D, counter-clockwise; edges AB (south), BC (east), CD (north), DA (west).
    const PLOT = [A, B, C, D];
    const EAST: EdgeSpec = { kind: 'road', roadId: 'east', rowWidthM: 8 };
    const SOUTH: EdgeSpec = { kind: 'road', roadId: 'south', rowWidthM: 20 };
    const EDGES = [SOUTH, EAST, NEIGHBOUR, NEIGHBOUR];

    /** The setting on the physical edge between two corners, whichever way it is stored. */
    function settingBetween(plot: readonly LngLat[], edges: readonly EdgeSpec[], p: LngLat, q: LngLat): EdgeSpec | undefined {
      const index = plot.findIndex((corner, i) => {
        const next = plot[(i + 1) % plot.length];
        return (corner === p && next === q) || (corner === q && next === p);
      });
      return edges[index];
    }

    test('keeps each setting on its physical edge when the winding is reversed from the same start', () => {
      const reversed = [A, D, C, B];
      const result = remapEdges(PLOT, EDGES, reversed);
      expect(settingBetween(reversed, result, A, B)).toEqual(SOUTH);
      expect(settingBetween(reversed, result, B, C)).toEqual(EAST);
      expect(settingBetween(reversed, result, C, D)).toEqual(NEIGHBOUR);
      expect(result).toEqual([NEIGHBOUR, NEIGHBOUR, EAST, SOUTH]);
    });

    test('keeps each setting on its physical edge when the ring starts at another corner', () => {
      const rotatedRing = [C, D, A, B];
      expect(remapEdges(PLOT, EDGES, rotatedRing)).toEqual([NEIGHBOUR, NEIGHBOUR, SOUTH, EAST]);
    });

    test('handles reversed and rotated together', () => {
      const ring = [C, B, A, D];
      const result = remapEdges(PLOT, EDGES, ring);
      expect(settingBetween(ring, result, A, B)).toEqual(SOUTH);
      expect(settingBetween(ring, result, B, C)).toEqual(EAST);
      expect(settingBetween(ring, result, D, A)).toEqual(NEIGHBOUR);
    });

    test('recognises corners within 1e-7 degrees after rounding', () => {
      const nudge = (p: LngLat): LngLat => [p[0] + 4e-8, p[1] - 4e-8];
      expect(remapEdges(PLOT, EDGES, [nudge(B), nudge(C), nudge(D), nudge(A)])).toEqual([EAST, NEIGHBOUR, NEIGHBOUR, SOUTH]);
    });

    test('follows a dragged corner when the drawing tool also reverses the ring', () => {
      // A clockwise plot: terra-draw makes it counter-clockwise when the drag finishes.
      const clockwise = [A, D, C, B];
      const clockwiseEdges = [NEIGHBOUR, NEIGHBOUR, EAST, SOUTH]; // AD, DC, CB, BA
      const movedC: LngLat = [100.6012, 13.6912];
      const result = remapEdges(clockwise, clockwiseEdges, [A, B, movedC, D]);
      expect(result).toEqual([SOUTH, EAST, NEIGHBOUR, NEIGHBOUR]);
    });

    test('splits the right edge when a corner is inserted into a reversed ring', () => {
      const clockwise = [A, D, C, B];
      const clockwiseEdges = [NEIGHBOUR, NEIGHBOUR, EAST, SOUTH];
      const onSouth: LngLat = [100.6005, 13.69];
      // Counter-clockwise after the insert, with a new corner on the south edge.
      const result = remapEdges(clockwise, clockwiseEdges, [A, onSouth, B, C, D]);
      expect(result).toEqual([SOUTH, SOUTH, EAST, NEIGHBOUR, NEIGHBOUR]);
    });
  });
});

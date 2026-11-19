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
});

/** Shared fixtures for geometry tests. Not exported from index.ts. */
import type { EdgeInfo, EdgeSetback, EdgeSpec, Pt, Region, Site } from '../types';
import { difference, regionArea } from './region';
import { perimeter, signedArea } from './ring';

export const P = (x: number, y: number): Pt => ({ x, y });

const NEIGHBOUR: EdgeSpec = { kind: 'neighbour' };

/** Site built directly from a CCW local ring, bypassing lng/lat validation. */
export function siteFromRing(ring: readonly Pt[], specs: readonly EdgeSpec[] = []): Site {
  const n = ring.length;
  const edges: EdgeInfo[] = ring.map((from, i) => {
    const to = ring[(i + 1) % n] as Pt;
    return { index: i, spec: specs[i] ?? NEIGHBOUR, lengthM: Math.hypot(to.x - from.x, to.y - from.y), from, to };
  });
  return { frame: { origin: [100.609, 13.689] }, ring, areaM2: signedArea(ring), perimeterM: perimeter(ring), edges };
}

export function rectRing(w: number, h: number, x0 = 0, y0 = 0): Pt[] {
  return [P(x0, y0), P(x0 + w, y0), P(x0 + w, y0 + h), P(x0, y0 + h)];
}

export function setbacksOf(distances: readonly number[]): EdgeSetback[] {
  return distances.map((distanceM, edgeIndex) => ({ edgeIndex, distanceM, ruleId: 'test' }));
}

/** Ring rotated to start at a different corner. */
export function rotate<T>(items: readonly T[], k: number): T[] {
  const n = items.length;
  return items.map((_, i) => items[(i + k) % n] as T);
}

/** Area of the symmetric difference: 0 when two regions are the same set. */
export function symDiffArea(a: Region, b: Region): number {
  return regionArea(difference(a, b)) + regionArea(difference(b, a));
}

export function allVertices(region: Region): Pt[] {
  return region.flatMap((p) => [...p.outer, ...p.holes.flat()]);
}

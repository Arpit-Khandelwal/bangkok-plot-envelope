import type { Path64 } from 'clipper2-ts';
import type { EdgeSetback, Pt, Region, Site } from '../types';
import { capsule } from './capsule';
import { booleanPaths, ringToPath } from './clipper-io';
import { difference, union } from './region';
import { ARC_TOLERANCE_M } from './tolerance';

/**
 * Per-edge setback distance, indexed by site edge. Several entries for one edge take
 * the largest. Entries with an unknown edge index, a negative or a non-numeric distance
 * are ignored (treated as no setback); an infinite distance removes everything near
 * that edge, which in practice is the whole plot.
 */
export function setbackDistances(site: Site, setbacks: readonly EdgeSetback[]): number[] {
  const d = site.edges.map(() => 0);
  for (const s of setbacks) {
    if (!Number.isInteger(s.edgeIndex) || s.edgeIndex < 0 || s.edgeIndex >= d.length) continue;
    if (!(s.distanceM > 0)) continue;
    d[s.edgeIndex] = Math.max(d[s.edgeIndex] as number, s.distanceM);
  }
  return d;
}

/**
 * Buildable footprint: the points of the plot at least d_i from edge segment i, for every
 * edge i. Computed as plot minus the union of one capsule (round-ended buffer) per edge,
 * which is the exact Euclidean rule at convex and reflex corners alike. The round ends
 * circumscribe the true arcs, so the result errs on the safe side by at most
 * ARC_TOLERANCE_M. Can return several pieces, or none; never throws.
 */
export function applySetbacks(site: Site, setbacks: readonly EdgeSetback[]): Region {
  const plot: Region = [{ outer: site.ring, holes: [] }];
  const d = setbackDistances(site, setbacks);
  const ring = site.ring;
  const n = ring.length;
  const capsules: Path64[] = [];
  for (let i = 0; i < n; i++) {
    const di = d[i] as number;
    if (!(di > 0)) continue;
    if (!Number.isFinite(di)) return [];
    const caps = capsule(ring[i] as Pt, ring[(i + 1) % n] as Pt, di, ARC_TOLERANCE_M);
    const path = ringToPath(caps, true);
    if (path) capsules.push(path);
  }
  if (capsules.length === 0) return union(plot);
  const strip = booleanPaths('union', capsules, [], 0);
  return difference(plot, strip);
}

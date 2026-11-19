/**
 * Frontage on a road: the straight run along it. For each maximal run of consecutive plot edges
 * on the road, the distance between the run's two end points projected onto the run's dominant
 * direction; the longest run counts. Separate runs on the same road are not added together, and a
 * sawtooth or a step does not lengthen a frontage.
 */
import { dominantAxis, extentAlong } from '../geom/direction';
import type { EdgeInfo, Site } from '../types';

/**
 * Frontages are kept to the micrometre. The lng/lat round trip of a drawn plot moves a 12.00 m edge
 * by under a nanometre (to 11.9999999993 m), which would otherwise fail a 12 m test it meets.
 */
const FRONTAGE_GRID_PER_M = 1e6;

function onRoad(edge: EdgeInfo | undefined, roadId: string): boolean {
  return edge?.spec.kind === 'road' && edge.spec.roadId === roadId;
}

/** Maximal runs of consecutive edges on the road, in ring order; a run may wrap past the last edge. */
export function roadRuns(site: Site, roadId: string): readonly (readonly EdgeInfo[])[] {
  const edges = site.edges;
  const n = edges.length;
  if (edges.every((e) => onRoad(e, roadId))) return [edges];
  const runs: EdgeInfo[][] = [];
  for (let i = 0; i < n; i++) {
    if (!onRoad(edges[i], roadId) || onRoad(edges[(i - 1 + n) % n], roadId)) continue;
    const run: EdgeInfo[] = [];
    for (let k = i; onRoad(edges[k % n], roadId) && run.length < n; k++) run.push(edges[k % n] as EdgeInfo);
    runs.push(run);
  }
  return runs;
}

function runFrontage(run: readonly EdgeInfo[], closed: boolean): number {
  const axis = dominantAxis(run);
  const first = run[0];
  const last = run[run.length - 1];
  if (axis === null || first === undefined || last === undefined) return 0;
  if (closed) {
    const span = extentAlong(run.map((e) => e.from), axis);
    return span.max - span.min;
  }
  return Math.abs((last.to.x - first.from.x) * axis.x + (last.to.y - first.from.y) * axis.y);
}

export function roadFrontage(site: Site, roadId: string): number {
  const runs = roadRuns(site, roadId);
  const closed = runs.length === 1 && runs[0]?.length === site.edges.length;
  const longest = runs.reduce((best, run) => Math.max(best, runFrontage(run, closed)), 0);
  return Math.round(longest * FRONTAGE_GRID_PER_M) / FRONTAGE_GRID_PER_M;
}

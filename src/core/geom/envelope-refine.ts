/**
 * Phase 1 of the envelope surface: make every height term linear on every triangle.
 *
 * Each road-plane limit is max(L_k, slope*row): the linear plane L_k on the inward side
 * of its edge line and the constant slope*row beyond it (only reachable on concave
 * plots). Triangles that straddle an edge line are cut along it. Cut points go in the
 * shared edge-split cache keyed by vertex ids, so both triangles on an edge receive the
 * same point and the triangulation stays conforming with no tolerance welding.
 */
import type { HeightPlane, Pt, Site } from '../types';
import { planeCoefficients, planeFloor } from './height';
import type { LinearFn } from './height';
import { resolveAll, VertexStore } from './triangulate';
import type { TriIds } from './triangulate';

/** Points within this distance (m) of an edge line count as on it. */
export const ON_LINE_M = 1e-6;
/** Safety cap on cuts along one refinement path. */
const MAX_DEPTH = 64;

export interface Term {
  readonly inward: LinearFn;
  readonly floor: LinearFn;
  /** Signed distance to the edge line, positive inward (unit gradient). */
  readonly line: LinearFn;
}

export const evalFn = (f: LinearFn, p: Pt): number => f.a * p.x + f.b * p.y + f.c;

export function termsOf(site: Site, planes: readonly HeightPlane[]): Term[] {
  const n = site.ring.length;
  return planes.map((plane) => {
    const from = site.ring[plane.edgeIndex] as Pt;
    const to = site.ring[(plane.edgeIndex + 1) % n] as Pt;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      inward: planeCoefficients(site, plane),
      floor: { a: 0, b: 0, c: planeFloor(plane) },
      line: { a: -dy / len, b: dx / len, c: (dy * from.x - dx * from.y) / len },
    };
  });
}

/** The linear functions in force on a set of points lying on one side of every edge line. */
export function linearFns(terms: readonly Term[], capFn: LinearFn | null, pts: readonly Pt[]): LinearFn[] {
  const fns: LinearFn[] = capFn ? [capFn] : [];
  for (const term of terms) {
    const inward = pts.every((p) => evalFn(term.line, p) >= -ON_LINE_M);
    fns.push(inward ? term.inward : term.floor);
  }
  return fns;
}

const signOf = (v: number): number => (v > ON_LINE_M ? 1 : v < -ON_LINE_M ? -1 : 0);

/** Cut a triangle along the unit-gradient line g = 0 if it strictly straddles it. */
function cut(store: VertexStore, tri: TriIds, g: LinearFn): TriIds[] | null {
  const vals = tri.map((i) => evalFn(g, store.at(i)));
  const signs = vals.map(signOf);
  if (!(signs.includes(1) && signs.includes(-1))) return null;
  const at = (k: number): number => tri[k % 3] as number;
  const val = (k: number): number => vals[k % 3] as number;
  const sgn = (k: number): number => signs[k % 3] as number;
  const t = (k: number): number => val(k) / (val(k) - val(k + 1));
  const zero = signs.indexOf(0);
  if (zero >= 0) {
    const m = store.splitEdge(at(zero + 1), at(zero + 2), t(zero + 1));
    return [
      [at(zero), at(zero + 1), m],
      [at(zero), m, at(zero + 2)],
    ];
  }
  const lone = [0, 1, 2].find((k) => sgn(k) !== sgn(k + 1) && sgn(k) !== sgn(k + 2)) as number;
  const p = store.splitEdge(at(lone), at(lone + 1), t(lone));
  const q = store.splitEdge(at(lone + 2), at(lone), t(lone + 2));
  return [
    [at(lone), p, q],
    [p, at(lone + 1), at(lone + 2)],
    [p, at(lone + 2), q],
  ];
}

/** Cut the triangulation along every edge line it straddles; result is conforming. */
export function cutByEdgeLines(store: VertexStore, seed: readonly TriIds[], terms: readonly Term[]): TriIds[] {
  const done: TriIds[] = [];
  const work: Array<{ readonly tri: TriIds; readonly depth: number }> = seed.map((tri) => ({ tri, depth: 0 }));
  while (work.length > 0) {
    const { tri, depth } = work.pop() as { tri: TriIds; depth: number };
    let pieces: TriIds[] | null = depth >= MAX_DEPTH ? null : store.resolve(tri);
    if (!pieces && depth < MAX_DEPTH) {
      for (const term of terms) {
        pieces = cut(store, tri, term.line);
        if (pieces) break;
      }
    }
    if (pieces) for (const p of pieces) work.push({ tri: p, depth: depth + 1 });
    else done.push(tri);
  }
  return resolveAll(store, done);
}

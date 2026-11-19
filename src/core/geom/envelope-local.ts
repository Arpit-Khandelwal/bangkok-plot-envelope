/**
 * Phase 2 of the envelope surface: on each triangle (where every term is linear) split
 * it into convex cells, one per term that is lowest there, by clipping the triangle with
 * the half-planes f_j >= f_m. Then fan each cell from its centroid.
 *
 * Conformity across triangles: the points where the lowest term changes along a shared
 * edge are computed once per edge (1D lower envelope, keyed by the edge's vertex ids)
 * and both triangles snap their cell vertices to those points and insert any they miss.
 * Within a triangle, cell vertices are shared by position (within SNAP_M).
 */
import type { Pt } from '../types';
import type { LinearFn } from './height';
import { evalFn, linearFns } from './envelope-refine';
import type { Term } from './envelope-refine';
import { distanceToSegment } from './ring';
import { edgeKey, triArea, VertexStore } from './triangulate';
import type { TriIds } from './triangulate';

/** Points closer than this (m) are one point when assembling cells. */
const SNAP_M = 1e-5;
/** Functions whose coefficients differ by less than this are the same function. */
const SAME_FN_EPS = 1e-12;

interface EdgeBreaks {
  /** Vertex ids along the edge from the lower id to the higher id, ends included. */
  readonly ids: readonly number[];
  /** Matching parameters in [0, 1]. */
  readonly ts: readonly number[];
  readonly len: number;
  readonly lo: number;
}

function dedupe(fns: readonly LinearFn[]): LinearFn[] {
  const out: LinearFn[] = [];
  for (const f of fns) {
    const same = out.some(
      (g) => Math.abs(g.a - f.a) < SAME_FN_EPS && Math.abs(g.b - f.b) < SAME_FN_EPS && Math.abs(g.c - f.c) < SAME_FN_EPS,
    );
    if (!same) out.push(f);
  }
  return out;
}

/** Parameters in (0, 1) where the lowest of the functions changes along P -> Q. */
function breakParams(fns: readonly LinearFn[], p: Pt, q: Pt): number[] {
  const v0 = fns.map((f) => evalFn(f, p));
  const sl = fns.map((f, i) => evalFn(f, q) - (v0[i] as number));
  let cur = 0;
  for (let i = 1; i < fns.length; i++) {
    const better = (v0[i] as number) < (v0[cur] as number) - 1e-12;
    const tie = Math.abs((v0[i] as number) - (v0[cur] as number)) <= 1e-12 && (sl[i] as number) < (sl[cur] as number);
    if (better || tie) cur = i;
  }
  const out: number[] = [];
  let t = 0;
  for (let guard = 0; guard <= fns.length; guard++) {
    let best = Infinity;
    let next = -1;
    for (let j = 0; j < fns.length; j++) {
      const ds = (sl[cur] as number) - (sl[j] as number);
      if (!(ds > 0)) continue;
      const tj = ((v0[j] as number) - (v0[cur] as number)) / ds;
      if (tj >= t && (tj < best || (tj === best && (sl[j] as number) < (sl[next] as number)))) {
        best = tj;
        next = j;
      }
    }
    if (next < 0 || best >= 1) break;
    if (best > 0) out.push(best);
    t = best;
    cur = next;
  }
  return out;
}

class EdgeCache {
  private readonly map = new Map<string, EdgeBreaks>();

  constructor(
    private readonly store: VertexStore,
    private readonly terms: readonly Term[],
    private readonly capFn: LinearFn | null,
  ) {}

  get(a: number, b: number): EdgeBreaks {
    const key = edgeKey(a, b);
    const found = this.map.get(key);
    if (found) return found;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const p = this.store.at(lo);
    const q = this.store.at(hi);
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const fns = dedupe(linearFns(this.terms, this.capFn, [p, q]));
    const ids = [lo];
    const ts = [0];
    for (const t of breakParams(fns, p, q)) {
      if (t * len < SNAP_M || (1 - t) * len < SNAP_M || (t - (ts[ts.length - 1] as number)) * len < SNAP_M) continue;
      ids.push(this.store.add({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) }));
      ts.push(t);
    }
    ids.push(hi);
    ts.push(1);
    const breaks = { ids, ts, len, lo };
    this.map.set(key, breaks);
    return breaks;
  }
}

/** Sutherland-Hodgman clip of a convex polygon to g >= 0. */
function clipConvex(poly: readonly Pt[], g: LinearFn): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i] as Pt;
    const q = poly[(i + 1) % poly.length] as Pt;
    const gp = evalFn(g, p);
    const gq = evalFn(g, q);
    if (gp >= 0) out.push(p);
    if (gp >= 0 !== gq >= 0) {
      const t = gp / (gp - gq);
      out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
  }
  return out;
}

function ringArea(poly: readonly Pt[]): number {
  let s = 0;
  for (let i = 1; i + 1 < poly.length; i++) s += triArea(poly[0] as Pt, poly[i] as Pt, poly[i + 1] as Pt);
  return s;
}

/** Convex cells of a triangle, one per function that is lowest somewhere on it. */
function cellsOf(pts: readonly Pt[], fns: readonly LinearFn[]): Pt[][] {
  const vals = fns.map((f) => pts.map((p) => evalFn(f, p)));
  const upper = Math.min(...vals.map((v) => Math.max(...v)));
  const live = fns.filter((_, i) => Math.min(...(vals[i] as number[])) <= upper + 1e-9);
  if (live.length === 1) return [[...pts]];
  // Clip first by the terms lowest at the corners: they empty most cells at once.
  const lowAtCorner = new Set<LinearFn>();
  for (let c = 0; c < pts.length; c++) {
    let best = live[0] as LinearFn;
    for (const f of live) if (evalFn(f, pts[c] as Pt) < evalFn(best, pts[c] as Pt)) best = f;
    lowAtCorner.add(best);
  }
  const order = [...lowAtCorner, ...live.filter((f) => !lowAtCorner.has(f))];
  const cells: Pt[][] = [];
  order.forEach((fm, m) => {
    let poly: Pt[] = [...pts];
    for (let j = 0; j < order.length && poly.length >= 3; j++) {
      if (j === m) continue;
      const fj = order[j] as LinearFn;
      poly = clipConvex(poly, { a: fj.a - fm.a, b: fj.b - fm.b, c: fj.c - fm.c });
    }
    if (poly.length >= 3 && ringArea(poly) > 0) cells.push(poly);
  });
  return cells;
}

/** Where an id sits on the triangle's sides: side index and parameter from that side's low id. */
type SidePos = ReadonlyArray<readonly [number, number]>;

/** Split one triangle into planar pieces whose boundaries match its neighbours'. */
function processTriangle(store: VertexStore, cache: EdgeCache, tri: TriIds, terms: readonly Term[], capFn: LinearFn | null): TriIds[] {
  const pts = tri.map((i) => store.at(i));
  const cells = cellsOf(pts, dedupe(linearFns(terms, capFn, pts)));
  const sides = [0, 1, 2].map((k) => cache.get(tri[k] as number, tri[(k + 1) % 3] as number));
  const onSide = new Map<number, Array<readonly [number, number]>>();
  sides.forEach((e, k) =>
    e.ids.forEach((id, i) => {
      const list = onSide.get(id) ?? [];
      list.push([k, e.ts[i] as number]);
      onSide.set(id, list);
    }),
  );
  const interior: number[] = [];

  const idOf = (p: Pt): number => {
    for (const e of sides) {
      const a = store.at(e.ids[0] as number);
      const b = store.at(e.ids[e.ids.length - 1] as number);
      if (distanceToSegment(p, a, b) >= SNAP_M) continue;
      const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (e.len * e.len);
      let best = -1;
      let bestD = SNAP_M;
      e.ts.forEach((tb, i) => {
        const d = Math.abs(tb - t) * e.len;
        if (d < bestD) {
          bestD = d;
          best = e.ids[i] as number;
        }
      });
      if (best >= 0) return best;
    }
    for (const id of interior) {
      const q = store.at(id);
      if (Math.hypot(q.x - p.x, q.y - p.y) < SNAP_M) return id;
    }
    const id = store.add(p);
    interior.push(id);
    return id;
  };

  const out: TriIds[] = [];
  for (const cell of cells) {
    const ring: number[] = [];
    for (const p of cell) {
      const id = idOf(p);
      if (ring[ring.length - 1] !== id) ring.push(id);
    }
    while (ring.length > 1 && ring[0] === ring[ring.length - 1]) ring.pop();
    if (ring.length < 3) continue;
    const full = insertOnEdges(store, ring, sides, onSide, interior);
    if (full.length === 3) {
      out.push([full[0] as number, full[1] as number, full[2] as number]);
      continue;
    }
    let gx = 0;
    let gy = 0;
    for (const id of full) {
      gx += store.at(id).x / full.length;
      gy += store.at(id).y / full.length;
    }
    const gid = store.add({ x: gx, y: gy });
    for (let i = 0; i < full.length; i++) out.push([full[i] as number, full[(i + 1) % full.length] as number, gid]);
  }
  return out;
}

/**
 * Complete a cell ring: along a triangle side, insert that side's canonical points that
 * fall between the edge's ends; elsewhere, insert interior vertices lying on the edge.
 */
function insertOnEdges(
  store: VertexStore,
  ring: readonly number[],
  sides: readonly EdgeBreaks[],
  onSide: ReadonlyMap<number, SidePos>,
  interior: readonly number[],
): number[] {
  const out: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const u = ring[i] as number;
    const v = ring[(i + 1) % ring.length] as number;
    out.push(u);
    const su = onSide.get(u) ?? [];
    const sv = onSide.get(v) ?? [];
    const shared = su.find(([k]) => sv.some(([k2]) => k2 === k));
    if (shared) {
      const k = shared[0];
      const tu = shared[1];
      const tv = (sv.find(([k2]) => k2 === k) as readonly [number, number])[1];
      const e = sides[k] as EdgeBreaks;
      const between = e.ids.filter((_, j) => {
        const t = e.ts[j] as number;
        return t > Math.min(tu, tv) && t < Math.max(tu, tv);
      });
      out.push(...(tu < tv ? between : [...between].reverse()));
      continue;
    }
    const a = store.at(u);
    const b = store.at(v);
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const hits: Array<readonly [number, number]> = [];
    for (const c of interior) {
      if (c === u || c === v) continue;
      const p = store.at(c);
      const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2;
      if (t <= 0 || t >= 1 || distanceToSegment(p, a, b) >= SNAP_M) continue;
      hits.push([t, c]);
    }
    hits.sort((x, y) => x[0] - y[0]);
    for (const [, c] of hits) out.push(c);
  }
  return out;
}

/** Phase 2 over all triangles. */
export function localEnvelope(store: VertexStore, tris: readonly TriIds[], terms: readonly Term[], capFn: LinearFn | null): TriIds[] {
  const cache = new EdgeCache(store, terms, capFn);
  return tris.flatMap((tri) => processTriangle(store, cache, tri, terms, capFn));
}

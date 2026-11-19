/**
 * Id-based triangle meshes in 2D. Vertices are addressed by id, never welded by position,
 * so points that are very close together but distinct stay distinct, and two triangles
 * share an edge exactly when they share both vertex ids.
 */
import earcut from 'earcut';
import type { Pt, Region } from '../types';

export type TriIds = readonly [number, number, number];

export interface FlatMesh {
  readonly verts: readonly Pt[];
  readonly tris: readonly TriIds[];
}

export function triArea(a: Pt, b: Pt, c: Pt): number {
  return ((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}

/** Undirected edge key for two vertex ids. */
export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

/**
 * Mutable vertex list plus a cache of points inserted on edges. Every edge is split at
 * most once per point and the same id is handed to both triangles that share the edge.
 */
export class VertexStore {
  readonly verts: Pt[] = [];
  private readonly splits = new Map<string, number>();

  add(p: Pt): number {
    this.verts.push(p);
    return this.verts.length - 1;
  }

  at(id: number): Pt {
    return this.verts[id] as Pt;
  }

  /** Id of the point already inserted on edge ab, if any. */
  splitOf(a: number, b: number): number | undefined {
    return this.splits.get(edgeKey(a, b));
  }

  /** Record that `mid` lies on edge ab. */
  setSplit(a: number, b: number, mid: number): void {
    this.splits.set(edgeKey(a, b), mid);
  }

  /** Insert (or reuse) the point at parameter t along ab, computed in canonical order. */
  splitEdge(a: number, b: number, tFromA: number): number {
    const found = this.splitOf(a, b);
    if (found !== undefined) return found;
    const [lo, hi, t] = a < b ? [a, b, tFromA] : [b, a, 1 - tFromA];
    const p = this.at(lo);
    const q = this.at(hi);
    const id = this.add({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    this.setSplit(a, b, id);
    return id;
  }

  /**
   * If an edge of the triangle carries a cached split point, the two triangles that
   * replace it (fanned from the opposite corner); otherwise null.
   */
  resolve(tri: TriIds): [TriIds, TriIds] | null {
    for (let k = 0; k < 3; k++) {
      const a = tri[k] as number;
      const b = tri[(k + 1) % 3] as number;
      const c = tri[(k + 2) % 3] as number;
      const m = this.splitOf(a, b);
      if (m !== undefined) return [[a, m, c], [m, b, c]];
    }
    return null;
  }
}

/**
 * Seed triangulation of a region with earcut (CCW triangles). Each polygon gets its own
 * vertex ids. Points earcut drops (exact collinear) are simply absent from the mesh. A
 * degenerate output triangle is not emitted; its middle vertex is recorded as a split of
 * its long edge, so the neighbour across that edge is split there and the mesh conforms.
 */
export function seedTriangulation(region: Region, store: VertexStore): TriIds[] {
  const tris: TriIds[] = [];
  for (const poly of region) {
    const rings = [poly.outer, ...poly.holes];
    const ids: number[] = [];
    const holeIndices: number[] = [];
    const o = poly.outer[0];
    if (!o || poly.outer.length < 3) continue;
    const flat: number[] = [];
    rings.forEach((ring, r) => {
      if (r > 0) holeIndices.push(ids.length);
      for (const p of ring) {
        ids.push(store.add(p));
        flat.push(p.x - o.x, p.y - o.y);
      }
    });
    const idx = earcut(flat, holeIndices.length > 0 ? holeIndices : null, 2);
    for (let i = 0; i + 2 < idx.length; i += 3) {
      const t = [ids[idx[i] as number], ids[idx[i + 1] as number], ids[idx[i + 2] as number]] as [number, number, number];
      const s = triArea(store.at(t[0]), store.at(t[1]), store.at(t[2]));
      if (s === 0) {
        recordDegenerate(store, t);
        continue;
      }
      tris.push(s > 0 ? t : [t[0], t[2], t[1]]);
    }
  }
  return tris;
}

function recordDegenerate(store: VertexStore, t: readonly [number, number, number]): void {
  // The vertex lying between the other two splits the edge joining them.
  for (let k = 0; k < 3; k++) {
    const m = t[k] as number;
    const a = t[(k + 1) % 3] as number;
    const b = t[(k + 2) % 3] as number;
    const pm = store.at(m);
    const pa = store.at(a);
    const pb = store.at(b);
    const dot = (pm.x - pa.x) * (pb.x - pa.x) + (pm.y - pa.y) * (pb.y - pa.y);
    const len2 = (pb.x - pa.x) ** 2 + (pb.y - pa.y) ** 2;
    if (dot > 0 && dot < len2 && store.splitOf(a, b) === undefined) {
      store.setSplit(a, b, m);
      return;
    }
  }
}

/** Apply cached edge splits until no triangle edge carries one. */
export function resolveAll(store: VertexStore, tris: readonly TriIds[]): TriIds[] {
  const out: TriIds[] = [];
  const work = [...tris];
  while (work.length > 0) {
    const t = work.pop() as TriIds;
    const parts = store.resolve(t);
    if (parts) work.push(...parts);
    else out.push(t);
  }
  return out;
}

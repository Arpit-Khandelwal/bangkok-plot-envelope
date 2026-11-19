/**
 * Closed solid from a conforming 2D triangulation (id-based): the top is the
 * triangulation lifted to a height per vertex, the base is the same triangles reversed
 * at baseZ, and walls stand on every directed edge whose reverse is absent (the
 * boundary, including holes). Every edge is then shared by exactly two triangles with
 * opposite directions. A vertex whose top is at the base reuses the base vertex, so
 * walls collapse cleanly where the height reaches zero.
 */
import type { Mesh, Pt } from '../types';
import { triArea } from './triangulate';
import type { TriIds } from './triangulate';
import { ZERO_HEIGHT_M } from './tolerance';

export interface Solid {
  readonly mesh: Mesh;
  /** Volume between the base and the top: sum of area x mean height (exact for planar faces). */
  readonly volumeM3: number;
  /** Highest top vertex, or baseZ when there is none. */
  readonly maxHeightM: number;
}

export function assembleSolid(
  verts: readonly Pt[],
  tris: readonly TriIds[],
  topZ: (id: number) => number,
  baseZ: number,
): Solid {
  const positions: number[] = [];
  const indices: number[] = [];
  const baseIdx = new Map<number, number>();
  const topIdx = new Map<number, number>();
  const zOf: number[] = [];
  const push = (p: Pt, z: number): number => {
    positions.push(p.x, p.y, z);
    zOf.push(z);
    return zOf.length - 1;
  };
  const base = (id: number): number => {
    let i = baseIdx.get(id);
    if (i === undefined) {
      i = push(verts[id] as Pt, baseZ);
      baseIdx.set(id, i);
    }
    return i;
  };
  const top = (id: number): number => {
    let i = topIdx.get(id);
    if (i === undefined) {
      const z = Math.max(baseZ, topZ(id));
      i = z - baseZ <= ZERO_HEIGHT_M ? base(id) : push(verts[id] as Pt, z);
      topIdx.set(id, i);
    }
    return i;
  };
  const tri = (a: number, b: number, c: number): void => {
    if (a !== b && b !== c && a !== c) indices.push(a, b, c);
  };

  let volume = 0;
  // Directed edge u -> v keyed as u * stride + v (ids are below stride).
  const stride = verts.length + 1;
  const directed = new Map<number, number>();
  for (const [a, b, c] of tris) {
    const ta = top(a);
    const tb = top(b);
    const tc = top(c);
    tri(ta, tb, tc);
    tri(base(a), base(c), base(b));
    const meanH = ((zOf[ta] as number) + (zOf[tb] as number) + (zOf[tc] as number)) / 3 - baseZ;
    volume += triArea(verts[a] as Pt, verts[b] as Pt, verts[c] as Pt) * meanH;
    for (const k of [a * stride + b, b * stride + c, c * stride + a]) directed.set(k, (directed.get(k) ?? 0) + 1);
  }
  for (const [key, n] of directed) {
    const u = Math.floor(key / stride);
    const v = key - u * stride;
    const reverse = directed.get(v * stride + u) ?? 0;
    // CCW triangles: on the boundary the right of u -> v faces out of the solid.
    for (let i = 0; i < n - reverse; i++) {
      tri(base(u), base(v), top(v));
      tri(base(u), top(v), top(u));
    }
  }

  let maxZ = baseZ;
  for (const z of zOf) maxZ = Math.max(maxZ, z);
  return {
    mesh: { positions: new Float32Array(positions), indices: new Uint32Array(indices) },
    volumeM3: volume,
    maxHeightM: maxZ,
  };
}

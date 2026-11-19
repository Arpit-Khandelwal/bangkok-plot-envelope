/** Mesh invariants used by tests (not part of the public API). */
import type { Mesh } from '../types';

export interface MeshReport {
  readonly hasNaN: boolean;
  readonly indicesInRange: boolean;
  /** Smallest triangle area in m2. */
  readonly minTriangleArea: number;
  /** Every undirected edge is used by exactly two triangles, once in each direction. */
  readonly watertight: boolean;
  /** Signed volume by the divergence theorem; positive when faces point outward. */
  readonly signedVolume: number;
  readonly triangles: number;
}

export function inspectMesh(mesh: Mesh): MeshReport {
  const { positions: pos, indices: idx } = mesh;
  const nVerts = pos.length / 3;
  const hasNaN = pos.some((v) => !Number.isFinite(v));
  const indicesInRange = idx.every((i) => i < nVerts);
  const directed = new Map<string, number>();
  let minArea = Infinity;
  let vol = 0;
  const v = (i: number): [number, number, number] => [pos[3 * i] as number, pos[3 * i + 1] as number, pos[3 * i + 2] as number];
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const ia = idx[t] as number;
    const ib = idx[t + 1] as number;
    const ic = idx[t + 2] as number;
    const a = v(ia);
    const b = v(ib);
    const c = v(ic);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cx = (u[1] as number) * (w[2] as number) - (u[2] as number) * (w[1] as number);
    const cy = (u[2] as number) * (w[0] as number) - (u[0] as number) * (w[2] as number);
    const cz = (u[0] as number) * (w[1] as number) - (u[1] as number) * (w[0] as number);
    minArea = Math.min(minArea, Math.hypot(cx, cy, cz) / 2);
    vol +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    for (const [p, q] of [
      [ia, ib],
      [ib, ic],
      [ic, ia],
    ] as const) {
      const k = `${p}>${q}`;
      directed.set(k, (directed.get(k) ?? 0) + 1);
    }
  }
  let watertight = idx.length > 0;
  for (const [k, count] of directed) {
    const [p, q] = k.split('>');
    if (count !== 1 || directed.get(`${q}>${p}`) !== 1) {
      watertight = false;
      break;
    }
  }
  return { hasNaN, indicesInRange, minTriangleArea: minArea, watertight, signedVolume: vol, triangles: idx.length / 3 };
}

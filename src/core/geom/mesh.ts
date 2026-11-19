import type { Mesh, Region } from '../types';
import { normalizeRaw } from './region';
import { assembleSolid } from './solid';
import { resolveAll, seedTriangulation, VertexStore } from './triangulate';

const EMPTY_MESH: Mesh = { positions: new Float32Array(0), indices: new Uint32Array(0) };

/**
 * Closed prism over a region from baseM up to topM: top and bottom faces plus walls
 * around every outer ring and hole. Handles several pieces. The region is snapped to the
 * millimetre grid first. Empty when the region is empty or topM <= baseM.
 */
export function extrudeRegion(region: Region, baseM: number, topM: number): Mesh {
  if (!Number.isFinite(baseM) || !Number.isFinite(topM) || !(topM > baseM)) return EMPTY_MESH;
  const snapped = normalizeRaw(region);
  if (snapped.length === 0) return EMPTY_MESH;
  const store = new VertexStore();
  const tris = resolveAll(store, seedTriangulation(snapped, store));
  return assembleSolid(store.verts, tris, () => topM, baseM).mesh;
}

/** Concatenate meshes into one, offsetting indices. Inputs are not modified. */
export function mergeMeshes(meshes: readonly Mesh[]): Mesh {
  let nPos = 0;
  let nIdx = 0;
  for (const m of meshes) {
    nPos += m.positions.length;
    nIdx += m.indices.length;
  }
  const positions = new Float32Array(nPos);
  const indices = new Uint32Array(nIdx);
  let posOffset = 0;
  let idxOffset = 0;
  for (const m of meshes) {
    positions.set(m.positions, posOffset);
    const base = posOffset / 3;
    for (let i = 0; i < m.indices.length; i++) indices[idxOffset + i] = (m.indices[i] as number) + base;
    posOffset += m.positions.length;
    idxOffset += m.indices.length;
  }
  return { positions, indices };
}

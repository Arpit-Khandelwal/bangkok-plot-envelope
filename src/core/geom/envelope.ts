import type { Envelope, HeightPlane, Region, Site } from '../types';
import { localEnvelope } from './envelope-local';
import { cutByEdgeLines, evalFn, termsOf } from './envelope-refine';
import { isValidPlane } from './height';
import { regionArea, union } from './region';
import { assembleSolid } from './solid';
import { seedTriangulation, VertexStore } from './triangulate';

/**
 * The buildable volume over a footprint: from the ground up to the lowest of the road
 * planes and the flat cap. The top surface is the exact lower envelope (planar facets),
 * the walls follow it exactly, and the mesh is a closed solid.
 *
 * Pipeline: earcut seed of the footprint -> cut along road-edge lines so each plane term
 * is linear per triangle -> split each triangle into convex cells of the lowest term ->
 * lift to the height limit, add base and walls.
 *
 * Returns null when there is nothing to build: an empty footprint, a cap at or below
 * zero, or neither planes nor a cap (an unbounded envelope is a caller error). Also null
 * for an invalid plane (unknown edge index, negative or non-finite slope or width), so
 * a bad rule can never silently produce a taller envelope.
 */
export function buildEnvelope(
  site: Site,
  footprint: Region,
  planes: readonly HeightPlane[],
  capM: number | null,
): Envelope | null {
  if (planes.length === 0 && capM === null) return null;
  if (capM !== null && !(capM > 0)) return null;
  if (!planes.every((p) => isValidPlane(site, p))) return null;
  const fp = union(footprint);
  if (fp.length === 0) return null;

  const store = new VertexStore();
  const terms = termsOf(site, planes);
  const linear = cutByEdgeLines(store, seedTriangulation(fp, store), terms);
  const tris = localEnvelope(store, linear, terms, capM === null ? null : { a: 0, b: 0, c: capM });
  // Same limit as heightLimitAt: slope * (max(0, d) + row) = max(inward plane, floor).
  const heightAt = (id: number): number => {
    const p = store.at(id);
    let h = capM ?? Infinity;
    for (const t of terms) h = Math.min(h, Math.max(evalFn(t.inward, p), t.floor.c));
    return h;
  };
  const solid = assembleSolid(store.verts, tris, heightAt, 0);
  if (!(solid.maxHeightM > 0)) return null;
  return {
    footprint: fp,
    footprintAreaM2: regionArea(fp),
    maxHeightM: solid.maxHeightM,
    volumeM3: solid.volumeM3,
    mesh: solid.mesh,
  };
}

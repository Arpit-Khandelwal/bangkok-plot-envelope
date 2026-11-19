/** The governing road edge of a design: what a shared level is cut parallel to and a tower slides toward. */
import type { EdgeInfo, Pt, Site } from '../types';
import type { DesignContext } from './context';
import { governingPlane } from './section';

function longestRoadEdge(site: Site): EdgeInfo | null {
  return site.edges.reduce<EdgeInfo | null>(
    (best, e) => (e.spec.kind === 'road' && (best === null || e.lengthM > best.lengthM) ? e : best),
    null,
  );
}

/** The governing plane's edge (longest edge of the widest road that limits height), else the longest road edge. */
export function governingRoadEdge(ctx: DesignContext): EdgeInfo | null {
  const plane = governingPlane(ctx.site, ctx.regime.heightPlanes);
  const byPlane = plane === null ? undefined : ctx.site.edges[plane.edgeIndex];
  return byPlane ?? longestRoadEdge(ctx.site);
}

/** Inward unit normal of an edge (the ring is counter-clockwise) and its offset: depth(p) = n.p - k. */
export function inwardLine(edge: EdgeInfo): { readonly n: Pt; readonly k: number } | null {
  const dx = edge.to.x - edge.from.x;
  const dy = edge.to.y - edge.from.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  const n = { x: -dy / len, y: dx / len };
  return { n, k: n.x * edge.from.x + n.y * edge.from.y };
}

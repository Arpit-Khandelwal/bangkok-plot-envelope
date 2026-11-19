/**
 * A vertical cut at right angles to the governing road edge, through the centroid of the
 * design's largest floor. Distances are measured from the road edge's line into the plot.
 */
import { centroid, largestPiece, signedDistanceToLine } from '../geom';
import type { Floor, HeightPlane, Pt, RegimeRules, Ring, SectionFloor, SectionProfile, Site } from '../types';

interface Cut {
  readonly origin: Pt;
  /** Unit inward normal of the road edge. */
  readonly dir: Pt;
  /** Signed distance of `origin` from the road edge line. */
  readonly originDistanceM: number;
}

/** Distances from the road line where the cut crosses the ring's edges. */
function crossings(ring: Ring, cut: Cut): number[] {
  const { origin: c, dir: n } = cut;
  const lateral = (q: Pt): number => n.x * (q.y - c.y) - n.y * (q.x - c.x);
  const along = (q: Pt): number => n.x * (q.x - c.x) + n.y * (q.y - c.y);
  const out: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as Pt;
    const b = ring[(i + 1) % ring.length] as Pt;
    const la = lateral(a);
    const lb = lateral(b);
    if ((la > 0 && lb > 0) || (la < 0 && lb < 0) || la === lb) continue;
    const t = la / (la - lb);
    out.push(cut.originDistanceM + along(a) + t * (along(b) - along(a)));
  }
  return out;
}

function span(rings: readonly Ring[], cut: Cut): { readonly near: number; readonly far: number } | null {
  const ds = rings.flatMap((r) => crossings(r, cut));
  if (ds.length < 2) return null;
  return { near: Math.min(...ds), far: Math.max(...ds) };
}

/** The longest edge of the widest road with a plane: the road the section is cut against. */
export function governingPlane(site: Site, planes: readonly HeightPlane[]): HeightPlane | null {
  let best: HeightPlane | null = null;
  for (const plane of planes) {
    const len = site.edges[plane.edgeIndex]?.lengthM ?? 0;
    const bestLen = best === null ? -1 : (site.edges[best.edgeIndex]?.lengthM ?? 0);
    const wider = best === null || plane.rowWidthM > best.rowWidthM;
    if (wider || (plane.rowWidthM === best?.rowWidthM && len > bestLen)) best = plane;
  }
  return best;
}

function largestFloor(floors: readonly Floor[]): Floor | null {
  return floors.reduce<Floor | null>((best, f) => (best === null || f.areaM2 > best.areaM2 ? f : best), null);
}

export function buildSection(site: Site, regime: RegimeRules, floors: readonly Floor[]): SectionProfile | null {
  const plane = governingPlane(site, regime.heightPlanes);
  const edge = plane === null ? undefined : site.edges[plane.edgeIndex];
  const biggest = largestFloor(floors);
  const piece = biggest === null ? undefined : largestPiece(biggest.outline)[0];
  if (plane === null || edge === undefined || piece === undefined || !(edge.lengthM > 0)) return null;
  const dir = { x: -(edge.to.y - edge.from.y) / edge.lengthM, y: (edge.to.x - edge.from.x) / edge.lengthM };
  const origin = centroid(piece.outer);
  const cut: Cut = { origin, dir, originDistanceM: signedDistanceToLine(origin, edge.from, edge.to) };
  const sectionFloors: SectionFloor[] = floors.flatMap((f) => {
    const s = span(f.outline.flatMap((p) => [p.outer, ...p.holes]), cut);
    return s === null ? [] : [{ level: f.level, use: f.use, baseM: f.baseM, topM: f.topM, nearM: s.near, farM: s.far }];
  });
  const plot = span([site.ring], cut);
  return {
    roadEdgeIndex: plane.edgeIndex,
    rowWidthM: plane.rowWidthM,
    setbackM: regime.setbacks[plane.edgeIndex]?.distanceM ?? 0,
    plotDepthM: plot === null ? 0 : Math.max(0, plot.far),
    slope: plane.slope,
    roofDeckCapM: regime.roofDeckCapM,
    floors: sectionFloors,
  };
}

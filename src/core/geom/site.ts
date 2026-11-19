import type { EdgeInfo, EdgeSpec, LngLat, Problem, ProblemCode, Pt, Site } from '../types';
import { makeFrame, toLocal } from './frame';
import { dedupeIndices, isSimple, perimeter, signedArea } from './ring';
import {
  COLLINEAR_TOLERANCE_M,
  DUPLICATE_POINT_M,
  MAX_PLOT_AREA_M2,
  MIN_PLOT_AREA_M2,
  TOUCH_TOLERANCE_M,
  ZERO_AREA_M2,
} from './tolerance';

export type BuildSiteResult = { readonly ok: true; readonly site: Site } | { readonly ok: false; readonly problems: Problem[] };

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

const MESSAGES: Readonly<Record<string, (n?: number) => string>> = {
  'too-few-points': () => 'The plot needs at least three separate corners. Add more corners to outline the land.',
  'bad-coordinates': () => 'Some plot corners have no valid position. Redraw the plot outline.',
  'edges-mismatch': () =>
    'Each side of the plot needs one description (road, neighbour or waterway), and the counts do not match. Redraw the plot or re-mark its sides.',
  'self-intersecting': () =>
    'The plot outline crosses or touches itself. Move a corner so the edges no longer cross.',
  'zero-area': () => 'The plot outline has no area: its corners lie on a line. Spread the corners out to enclose the land.',
  'too-small': (n) =>
    `The plot is only about ${fmt(n ?? 0)} m², smaller than the ${MIN_PLOT_AREA_M2} m² this tool can assess. Check the outline or draw a larger plot.`,
  'too-large': (n) =>
    `The plot is about ${fmt(n ?? 0)} m², larger than the ${fmt(MAX_PLOT_AREA_M2)} m² (250 rai) this tool can assess. Draw a single plot rather than a whole block.`,
};

function problem(code: ProblemCode, key: string = code, n?: number): Problem {
  const make = MESSAGES[key] ?? MESSAGES[code];
  return { code, message: make ? make(n) : code, blocking: true };
}

/** Largest distance of any point from the line through the two points farthest apart. */
function collinearSpread(points: readonly Pt[]): number {
  let ia = 0;
  let ib = 0;
  let best = -1;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const p = points[i] as Pt;
      const q = points[j] as Pt;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > best) {
        best = d;
        ia = i;
        ib = j;
      }
    }
  }
  const a = points[ia] as Pt;
  const b = points[ib] as Pt;
  if (best <= 0) return 0;
  let spread = 0;
  for (const p of points) {
    spread = Math.max(spread, Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / best);
  }
  return spread;
}

/**
 * Validate and normalise a drawn plot. The result ring is counter-clockwise in local
 * metres with near-duplicate corners merged, and `edges[i].spec` describes the same
 * physical side as the input spec it came from, whatever the drawing direction.
 */
export function buildSite(plot: readonly LngLat[], edges: readonly EdgeSpec[]): BuildSiteResult {
  if (plot.length < 3) return { ok: false, problems: [problem('too-few-points')] };
  if (edges.length !== plot.length) return { ok: false, problems: [problem('edges-mismatch')] };
  if (!plot.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[1]) < 90)) {
    return { ok: false, problems: [problem('invalid-coordinates', 'bad-coordinates')] };
  }

  const frame = makeFrame(plot);
  const local = plot.map((p) => toLocal(frame, p));

  // Merge near-duplicate corners. Edge i runs from corner i to i+1; when corner k is
  // dropped as a duplicate of the kept corner before it, the zero-length edge into it
  // goes and the kept corner takes over the edge leaving k (spec of edge k).
  const kept = dedupeIndices(local, DUPLICATE_POINT_M);
  if (kept.length < 3) return { ok: false, problems: [problem('too-few-points')] };
  let ring: Pt[] = kept.map((i) => local[i] as Pt);
  let sources: number[] = kept.map((start, j) => {
    const end = kept[j + 1] ?? (kept[0] as number) + plot.length;
    // Original edges start .. end-1 now form one side; all but one are (near) zero
    // length, so the side keeps the spec of the longest of them.
    let best = start;
    let bestLen = -1;
    for (let e = start; e < end; e++) {
      const a = local[e % plot.length] as Pt;
      const b = local[(e + 1) % plot.length] as Pt;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > bestLen) {
        bestLen = len;
        best = e % plot.length;
      }
    }
    return best;
  });

  // Collinear first (such outlines also fold back on themselves), then crossing, then
  // area: a symmetric bow-tie has zero signed area but is a crossing problem.
  if (collinearSpread(ring) <= COLLINEAR_TOLERANCE_M) return { ok: false, problems: [problem('zero-area')] };
  if (!isSimple(ring, TOUCH_TOLERANCE_M)) return { ok: false, problems: [problem('self-intersecting')] };
  let area = signedArea(ring);
  if (Math.abs(area) < ZERO_AREA_M2) return { ok: false, problems: [problem('zero-area')] };
  if (area < 0) {
    // Reverse but keep corner 0 first: new corner j = old corner (n - j) % n, and new
    // edge j (old corner n-j to old corner n-j-1) is old edge n-1-j traversed backwards.
    const n = ring.length;
    const oldRing = ring;
    const oldSources = sources;
    ring = oldRing.map((_, j) => oldRing[(n - j) % n] as Pt);
    sources = oldSources.map((_, j) => oldSources[n - 1 - j] as number);
    area = -area;
  }
  if (area < MIN_PLOT_AREA_M2) return { ok: false, problems: [problem('too-small', 'too-small', area)] };
  if (area > MAX_PLOT_AREA_M2) return { ok: false, problems: [problem('too-large', 'too-large', area)] };

  const n = ring.length;
  const edgeInfos: EdgeInfo[] = ring.map((from, i) => {
    const to = ring[(i + 1) % n] as Pt;
    const sourceIndex = sources[i] as number;
    return { index: i, sourceIndex, spec: edges[sourceIndex] as EdgeSpec, lengthM: Math.hypot(to.x - from.x, to.y - from.y), from, to };
  });
  return { ok: true, site: { frame, ring, areaM2: area, perimeterM: perimeter(ring), edges: edgeInfos } };
}

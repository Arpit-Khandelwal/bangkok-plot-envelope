import type { EdgeSpec, LngLat } from '../core/types';

const NEIGHBOUR: EdgeSpec = { kind: 'neighbour' };

/** Corners closer than this (degrees, about 1 cm) are the same corner, despite rounding. */
const SAME_POINT_TOLERANCE_DEG = 1e-7;

function samePoint(a: LngLat | undefined, b: LngLat | undefined): boolean {
  return (
    a !== undefined &&
    b !== undefined &&
    Math.abs(a[0] - b[0]) <= SAME_POINT_TOLERANCE_DEG &&
    Math.abs(a[1] - b[1]) <= SAME_POINT_TOLERANCE_DEG
  );
}

/** Sign of the shoelace area: 1 counter-clockwise, -1 clockwise, 0 degenerate. */
function winding(ring: readonly LngLat[]): number {
  const origin = ring[0];
  if (!origin) return 0;
  let sum = 0;
  ring.forEach((point, index) => {
    const next = ring[(index + 1) % ring.length] ?? point;
    sum += (point[0] - origin[0]) * (next[1] - origin[1]) - (next[0] - origin[0]) * (point[1] - origin[1]);
  });
  return Math.sign(sum);
}

/** The same ring walked the other way from the same first corner. */
function reversedFromStart(ring: readonly LngLat[]): LngLat[] {
  const [first, ...rest] = ring;
  return first ? [first, ...rest.reverse()] : [];
}

/** The ring started at corner `start`. */
function rotated<T>(items: readonly T[], start: number): T[] {
  return [...items.slice(start), ...items.slice(0, start)];
}

/**
 * The rotation r for which next[i] is previous[(i + r) % n] at all but at most one corner (one
 * corner may have been dragged), preferring no rotation; null if there is none.
 */
function matchingRotation(previous: readonly LngLat[], next: readonly LngLat[]): number | null {
  const count = previous.length;
  let best: { readonly rotation: number; readonly misses: number } | null = null;
  for (let rotation = 0; rotation < count; rotation += 1) {
    let misses = 0;
    for (let index = 0; index < count && misses <= 1; index += 1) {
      if (!samePoint(next[index], previous[(index + rotation) % count])) misses += 1;
    }
    if (misses <= 1 && (!best || misses < best.misses)) best = { rotation, misses };
    if (best?.misses === 0) break;
  }
  return best ? best.rotation : null;
}

/** Index of the first position where the two rings differ, or the shorter length if one is a prefix. */
function firstDifference(previous: readonly LngLat[], next: readonly LngLat[]): number {
  const shared = Math.min(previous.length, next.length);
  for (let index = 0; index < shared; index += 1) {
    if (!samePoint(previous[index], next[index])) return index;
  }
  return shared;
}

export function neighbourEdges(count: number): EdgeSpec[] {
  return Array.from({ length: count }, () => NEIGHBOUR);
}

/**
 * Carries edge settings across an edit of the plot outline, so that marking a road
 * survives dragging a corner, adding a corner on an edge, or deleting a corner, and so that
 * each setting stays on the same PHYSICAL edge when the drawing tool hands back the ring
 * walked the other way (terra-draw turns clockwise rings counter-clockwise when an edit
 * finishes) or started from another corner.
 *
 * Corners are compared with a tolerance of 1e-7 degrees. Steps:
 * - Opposite winding: walk the new ring the previous way round, remap, and map back.
 * - Same corner count and the same corners (all but at most one, which was dragged) from
 *   another starting corner: each edge takes the setting of the edge it coincides with.
 * - One more or one fewer corner, starting elsewhere: align the start, then as below.
 *
 * `edges[i]` describes the edge from `plot[i]` to `plot[i + 1]`.
 * - Same corner count: a corner was moved. Every edge keeps its setting.
 * - One more corner: an edge was split. Both halves inherit the split edge's setting.
 * - One fewer corner: two edges merged. The merged edge keeps the first one's setting.
 * - Anything else is a new plot, so every edge starts as a neighbour boundary.
 */
export function remapEdges(
  previousPlot: readonly LngLat[],
  previousEdges: readonly EdgeSpec[],
  nextPlot: readonly LngLat[],
): EdgeSpec[] {
  const previousCount = previousPlot.length;
  const nextCount = nextPlot.length;
  if (previousEdges.length !== previousCount || previousCount < 3) return neighbourEdges(nextCount);

  const previousWinding = winding(previousPlot);
  const nextWinding = winding(nextPlot);
  if (previousWinding !== 0 && nextWinding !== 0 && previousWinding !== nextWinding) {
    const flipped = remapSameWinding(previousPlot, previousEdges, reversedFromStart(nextPlot));
    // Edge i of the new ring is edge (n - 1 - i) of the flipped one, walked backwards.
    return nextPlot.map((_, index) => flipped[(nextCount - 1 - index) % nextCount] ?? NEIGHBOUR);
  }
  return remapSameWinding(previousPlot, previousEdges, nextPlot);
}

function remapSameWinding(
  previousPlot: readonly LngLat[],
  previousEdges: readonly EdgeSpec[],
  nextPlot: readonly LngLat[],
): EdgeSpec[] {
  const previousCount = previousPlot.length;
  const nextCount = nextPlot.length;

  if (nextCount === previousCount) {
    const rotation = matchingRotation(previousPlot, nextPlot) ?? 0;
    return nextPlot.map((_, index) => previousEdges[(index + rotation) % previousCount] ?? NEIGHBOUR);
  }

  if (Math.abs(nextCount - previousCount) === 1) {
    const start = nextPlot.findIndex((point) => samePoint(point, previousPlot[0]));
    if (start > 0) {
      const aligned = remapAligned(previousPlot, previousEdges, rotated(nextPlot, start));
      return nextPlot.map((_, index) => aligned[(index - start + nextCount) % nextCount] ?? NEIGHBOUR);
    }
  }
  return remapAligned(previousPlot, previousEdges, nextPlot);
}

/** Edits where the two rings start at the same corner and run the same way round. */
function remapAligned(
  previousPlot: readonly LngLat[],
  previousEdges: readonly EdgeSpec[],
  nextPlot: readonly LngLat[],
): EdgeSpec[] {
  const previousCount = previousPlot.length;
  const nextCount = nextPlot.length;

  if (nextCount === previousCount) return [...previousEdges];

  if (nextCount === previousCount + 1) {
    const insertedAt = firstDifference(previousPlot, nextPlot);
    // A corner inserted at index k splits the edge that ended at the old corner k.
    const splitEdge = (insertedAt - 1 + previousCount) % previousCount;
    const inherited = previousEdges[splitEdge] ?? NEIGHBOUR;
    return [...previousEdges.slice(0, insertedAt), inherited, ...previousEdges.slice(insertedAt)];
  }

  if (nextCount === previousCount - 1 && nextCount >= 3) {
    const removedAt = firstDifference(previousPlot, nextPlot);
    // Removing corner k merges edge k-1 and edge k. Drop edge k; edge k-1 keeps its setting.
    return previousEdges.filter((_, index) => index !== removedAt);
  }

  return neighbourEdges(nextCount);
}

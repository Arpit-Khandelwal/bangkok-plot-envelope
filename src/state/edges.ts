import type { EdgeSpec, LngLat } from '../core/types';

const NEIGHBOUR: EdgeSpec = { kind: 'neighbour' };

function samePoint(a: LngLat | undefined, b: LngLat | undefined): boolean {
  return a !== undefined && b !== undefined && a[0] === b[0] && a[1] === b[1];
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
 * survives dragging a corner, adding a corner on an edge, or deleting a corner.
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

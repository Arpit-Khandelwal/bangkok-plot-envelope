/**
 * Names of plot edges as the user sees them: A, B, ... Z, then A2, B2, ... Always pass the
 * edge's `sourceIndex` (its place in the drawn plot), never its index in `site.edges`.
 * Behaves exactly like `edgeLetter` in src/map/edgeLabels.ts, which labels the map.
 */
import type { Site } from './types';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function edgeLetter(index: number): string {
  const letter = LETTERS[index % LETTERS.length] ?? '?';
  const round = Math.floor(index / LETTERS.length);
  return round === 0 ? letter : `${letter}${round + 1}`;
}

/** The user-facing letter of a site edge (by its index in `site.edges`). */
export function siteEdgeLetter(site: Site, siteIndex: number): string {
  const edge = site.edges[siteIndex];
  return edgeLetter(edge === undefined ? siteIndex : edge.sourceIndex);
}

/** "edge A", "edges A and C", "edges A, B and D", in drawn order. Takes site-edge indices. */
export function edgeListText(site: Site, siteIndices: readonly number[]): string {
  const sources = siteIndices
    .map((i) => site.edges[i]?.sourceIndex ?? i)
    .slice()
    .sort((a, b) => a - b);
  const labels = sources.map(edgeLetter);
  if (labels.length === 0) return 'no edges';
  if (labels.length === 1) return `edge ${labels[0] ?? ''}`;
  const last = labels[labels.length - 1] ?? '';
  return `edges ${labels.slice(0, -1).join(', ')} and ${last}`;
}

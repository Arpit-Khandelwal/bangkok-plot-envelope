import type { RoadSetbackBand, RoadSetbackSpec } from '../data/spec';
import { edgeList, m, num } from '../format';
import type { Resolver, SetbackDemand } from './types';

export interface RoadSetbackResult {
  /** Distance inside the plot's road edge. */
  readonly distanceM: number;
  readonly band: RoadSetbackBand;
  /** Lower bound of the band and whether it is included, for the explanation. */
  readonly fromRowM: number;
  readonly fromIncluded: boolean;
}

/**
 * The road-width table converted to a distance from the plot's road edge, assuming the plot
 * edge is the road boundary. Returns null only if the bands do not cover the width.
 */
export function roadSetbackFromEdge(
  bands: readonly RoadSetbackBand[],
  rowWidthM: number,
): RoadSetbackResult | null {
  let fromRowM = 0;
  let fromIncluded = true;
  for (const band of bands) {
    const until = band.untilRowM;
    const inBand =
      until === null || rowWidthM < until || (band.includesUntil && rowWidthM === until);
    if (inBand) {
      return { distanceM: bandDistance(band, rowWidthM), band, fromRowM, fromIncluded };
    }
    fromRowM = until;
    fromIncluded = !band.includesUntil;
  }
  return null;
}

function bandDistance(band: RoadSetbackBand, rowWidthM: number): number {
  const rule = band.rule;
  switch (rule.kind) {
    case 'fromCentreline':
      return Math.max(0, rule.distanceM - rowWidthM / 2);
    case 'shareOfRow':
      return rule.share * rowWidthM;
    case 'fromBoundary':
      return rule.distanceM;
  }
}

function rangeText(r: RoadSetbackResult): string {
  const until = r.band.untilRowM;
  if (until === null) return `${r.fromIncluded ? 'at least' : 'over'} ${m(r.fromRowM)}`;
  if (r.fromRowM === 0) return `${r.band.includesUntil ? 'at most' : 'under'} ${m(until)}`;
  return `between ${m(r.fromRowM)} and ${m(until)}`;
}

function explain(rowWidthM: number, r: RoadSetbackResult): string {
  const head = `The road is ${m(rowWidthM)} wide, ${rangeText(r)}, so the building line is`;
  const rule = r.band.rule;
  switch (rule.kind) {
    case 'fromCentreline':
      return `${head} ${m(rule.distanceM)} from the road centreline: ${m(r.distanceM)} inside the plot edge.`;
    case 'shareOfRow':
      return `${head} ${num(rule.share * 100)}% of the road width, ${m(r.distanceM)}, inside the plot edge.`;
    case 'fromBoundary':
      return `${head} ${m(r.distanceM)} inside the plot edge.`;
  }
}

const EDGE_ASSUMPTION =
  'This takes the plot edge as the road boundary; a planned road widening would move it.';

export const resolveRoadSetback: Resolver<RoadSetbackSpec> = (spec, input) => {
  const parts = input.roads.flatMap((road) => {
    const result = roadSetbackFromEdge(spec.bands, road.rowWidthM);
    if (result === null) return [];
    const demands: SetbackDemand[] = road.edgeIndices.map((edgeIndex) => ({
      edgeIndex,
      distanceM: result.distanceM,
    }));
    return [
      {
        demands,
        requirement: `Keep the building at least ${m(result.distanceM)} back from the ${m(road.rowWidthM)} road (${edgeList(input.site, road.edgeIndices)}).`,
        basis: explain(road.rowWidthM, result),
      },
    ];
  });
  if (parts.length === 0) {
    return { requirement: 'No plot edge faces a road, so no building line applies.', effects: {} };
  }
  return {
    requirement: parts.map((p) => p.requirement).join(' '),
    basis: [...parts.map((p) => p.basis), EDGE_ASSUMPTION].join(' '),
    effects: { setbacks: parts.flatMap((p) => p.demands) },
  };
};

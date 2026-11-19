import type { EdgeInfo } from '../../types';
import type { EdgeKind, UniformSetbackSpec, WaterwayBand, WaterwaySetbackSpec } from '../data/spec';
import { edgeList, m, mVs } from '../format';
import type { Resolver } from './types';

const EDGE_KIND_LABEL: Readonly<Record<EdgeKind, string>> = {
  road: 'roads',
  neighbour: 'neighbouring land',
  waterway: 'waterways',
};

function targetsText(kinds: readonly EdgeKind[], allEdges: boolean): string {
  if (allEdges) return 'every plot boundary';
  const labels = kinds.map((k) => EDGE_KIND_LABEL[k]);
  return labels.join(' and ');
}

export const resolveUniformSetback: Resolver<UniformSetbackSpec> = (spec, input) => {
  const edges = input.site.edges.filter((e) => spec.appliesTo.includes(e.spec.kind));
  const allEdges = edges.length === input.site.edges.length;
  const targets = targetsText(spec.appliesTo, allEdges);
  const requirement =
    edges.length === 0
      ? `Keep ${spec.what} at least ${m(spec.distanceM)} from ${targets}; this plot has no such edge.`
      : `Keep ${spec.what} at least ${m(spec.distanceM)} from ${targets} (${edgeList(input.site, edges.map((e) => e.index))}).`;
  return {
    requirement,
    ...(spec.assumption === undefined ? {} : { basis: spec.assumption }),
    effects: {
      setbacks: edges.map((e) => ({ edgeIndex: e.index, distanceM: spec.distanceM })),
    },
  };
};

/** The band bound nearest a waterway width, so the width is shown on the right side of it. */
function nearestWaterwayBound(bands: readonly WaterwayBand[], widthM: number): number | null {
  const bounds = bands.flatMap((b) => (b.belowWidthM === null ? [] : [b.belowWidthM]));
  return bounds.reduce<number | null>((best, b) => (best === null || Math.abs(b - widthM) < Math.abs(best - widthM) ? b : best), null);
}

function widthText(bands: readonly WaterwayBand[], widthM: number): string {
  const bound = nearestWaterwayBound(bands, widthM);
  return bound === null ? m(widthM) : mVs(widthM, bound).value;
}

export function waterwaySetback(bands: readonly WaterwayBand[], widthM: number): number | null {
  const band = bands.find((b) => b.belowWidthM === null || widthM < b.belowWidthM);
  return band?.distanceM ?? null;
}

function waterwayWidth(edge: EdgeInfo): number | null {
  return edge.spec.kind === 'waterway' ? edge.spec.widthM : null;
}

export const resolveWaterwaySetback: Resolver<WaterwaySetbackSpec> = (spec, input) => {
  const parts = input.site.edges.flatMap((edge) => {
    const width = waterwayWidth(edge);
    const distance = width === null ? null : waterwaySetback(spec.bands, width);
    if (width === null || distance === null) return [];
    return [{ edgeIndex: edge.index, width, distance }];
  });
  if (parts.length === 0) {
    return { requirement: 'No plot edge faces a public waterway, so no waterway setback applies.', effects: {} };
  }
  const requirement = parts
    .map((p) => `Keep the building at least ${m(p.distance)} from the ${widthText(spec.bands, p.width)} wide waterway (${edgeList(input.site, [p.edgeIndex])}).`)
    .join(' ');
  const bandText = spec.bands
    .map((b) => (b.belowWidthM === null ? `${m(b.distanceM)} otherwise` : `${m(b.distanceM)} for a waterway under ${m(b.belowWidthM)} wide`))
    .join(', ');
  return {
    requirement,
    basis: `The setback is ${bandText}, measured from the waterway boundary. Lakes, reservoirs and the sea need more and are not covered.`,
    effects: { setbacks: parts.map((p) => ({ edgeIndex: p.edgeIndex, distanceM: p.distance })) },
  };
};

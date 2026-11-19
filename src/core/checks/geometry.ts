/** Open space, setbacks and the road height plane, measured on the floor outlines. */
import { heightLimitAt, minDistanceToSegment, signedDistanceToLine } from '../geom';
import { edgeListText, siteEdgeLetter } from '../edgeNames';
import { m, m2, pct } from '../rules/format';
import type { Check, EdgeSetback, OpenSpaceRequirement, Pt } from '../types';
import { makeCheck, passFail, titleOf } from './context';
import type { CheckInput, Measured } from './context';

/** A floor may come this close to a setback line without failing (capsule arcs, mm grid). */
export const SETBACK_TOLERANCE_M = 0.02;
/** A floor top may exceed the height plane by this much without failing. */
export const HEIGHT_TOLERANCE_M = 0.01;

function basisArea(req: OpenSpaceRequirement, input: CheckInput, measured: Measured): number {
  switch (req.basis) {
    case 'plotArea':
      return input.site.areaM2;
    case 'totalFloorArea':
      return measured.sums.gross;
    case 'largestFloor':
      return measured.largestFloorM2;
  }
}

const BASIS_LABEL: Readonly<Record<OpenSpaceRequirement['basis'], string>> = {
  plotArea: 'of the plot',
  totalFloorArea: 'of the total floor area',
  largestFloor: 'of the largest floor',
};

export function requiredOpenSpace(req: OpenSpaceRequirement, input: CheckInput, measured: Measured): number {
  return req.share * basisArea(req, input, measured);
}

function openSpaceCheck(input: CheckInput, measured: Measured, req: OpenSpaceRequirement): Check {
  const required = requiredOpenSpace(req, input, measured);
  const open = input.site.areaM2 - measured.coverageM2;
  return makeCheck(input, {
    ruleId: req.ruleId,
    title: titleOf(input, req.ruleId, 'Open space'),
    status: passFail(open >= required),
    required: `Open ground at least ${m2(required)}: ${pct(req.share)} ${BASIS_LABEL[req.basis]} (${m2(basisArea(req, input, measured))}).`,
    actual: `${m2(open)} open: the ${m2(input.site.areaM2)} plot less ${m2(measured.coverageM2)} covered by the building.`,
  });
}

interface EdgeResult {
  readonly setback: EdgeSetback;
  readonly actualM: number;
}

function setbackCheck(input: CheckInput, measured: Measured, ruleId: string, group: readonly EdgeSetback[]): Check {
  const results: EdgeResult[] = group.map((setback) => {
    const edge = input.site.edges[setback.edgeIndex];
    const actualM = edge === undefined ? Infinity : minDistanceToSegment(measured.footprint, edge.from, edge.to);
    return { setback, actualM };
  });
  const worst = results.reduce((a, b) => (b.actualM - b.setback.distanceM < a.actualM - a.setback.distanceM ? b : a));
  const distances = [...new Set(group.map((s) => s.distanceM))];
  const requiredText =
    distances.length === 1
      ? `At least ${m(distances[0] ?? 0)} from ${edgeListText(input.site, group.map((s) => s.edgeIndex))}.`
      : group.map((s) => `${m(s.distanceM)} from ${edgeListText(input.site, [s.edgeIndex])}`).join('; ');
  const ok = worst.actualM >= worst.setback.distanceM - SETBACK_TOLERANCE_M;
  return makeCheck(input, {
    ruleId,
    title: titleOf(input, ruleId, 'Setback'),
    status: passFail(ok),
    required: requiredText,
    actual: `Closest: ${m(worst.actualM)} from edge ${siteEdgeLetter(input.site, worst.setback.edgeIndex)} (${m(worst.setback.distanceM)} required there).`,
  });
}

function setbackChecks(input: CheckInput, measured: Measured): readonly Check[] {
  const groups = new Map<string, EdgeSetback[]>();
  for (const s of input.regime.setbacks) {
    if (s.ruleId === null || !(s.distanceM > 0)) continue;
    groups.set(s.ruleId, [...(groups.get(s.ruleId) ?? []), s]);
  }
  if (measured.footprint.length === 0) return [];
  return [...groups.entries()].map(([ruleId, group]) => setbackCheck(input, measured, ruleId, group));
}

interface Worst {
  readonly excessM: number;
  readonly level: number;
  readonly topM: number;
  readonly limitM: number;
  readonly point: Pt;
}

function worstHeight(input: CheckInput): Worst | null {
  const planes = input.regime.heightPlanes;
  let worst: Worst | null = null;
  for (const floor of input.floors) {
    const topM = floor.topM + input.assumptions.parapetM;
    for (const poly of floor.outline) {
      for (const point of [poly.outer, ...poly.holes].flat()) {
        const limitM = heightLimitAt(input.site, planes, null, point);
        const excessM = topM - limitM;
        if (worst === null || excessM > worst.excessM) worst = { excessM, level: floor.level, topM, limitM, point };
      }
    }
  }
  return worst;
}

function heightCheck(input: CheckInput): readonly Check[] {
  const plane = input.regime.heightPlanes[0];
  const worst = worstHeight(input);
  if (plane === undefined || worst === null) return [];
  const edge = input.site.edges[plane.edgeIndex];
  const depth = edge === undefined ? 0 : Math.max(0, signedDistanceToLine(worst.point, edge.from, edge.to));
  const where = `at level ${worst.level}, ${m(depth)} from edge ${siteEdgeLetter(input.site, plane.edgeIndex)} (parapet top ${m(worst.topM)}, limit ${m(worst.limitM)})`;
  const ok = worst.excessM <= HEIGHT_TOLERANCE_M;
  return [
    makeCheck(input, {
      ruleId: plane.ruleId,
      title: titleOf(input, plane.ruleId, 'Height limit from the road'),
      status: passFail(ok),
      required: `Every floor, parapet included, at most ${plane.slope} times its distance to the far side of the road.`,
      actual: ok ? `Lowest clearance ${m(Math.max(0, -worst.excessM))}, ${where}.` : `Over the limit by ${m(worst.excessM)}, ${where}.`,
    }),
  ];
}

export function geometryChecks(input: CheckInput, measured: Measured): readonly Check[] {
  return [
    ...input.regime.openSpace.map((req) => openSpaceCheck(input, measured, req)),
    ...setbackChecks(input, measured),
    ...heightCheck(input),
  ];
}

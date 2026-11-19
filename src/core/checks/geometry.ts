/** Open space, setbacks and the road height plane, measured on the floor outlines. */
import { minDistanceToSegment, planeCoefficients, planeFloor, signedDistanceToLine } from '../geom';
import type { LinearFn } from '../geom';
import { edgeListText, siteEdgeLetter } from '../edgeNames';
import { m, m2, m2Vs, mVs, pct } from '../rules/format';
import { heightPlaneSpec, heightRoads } from '../rules';
import type { Check, EdgeSetback, HeightPlane, OpenSpaceRequirement, Pt } from '../types';
import { isEnabled, makeCheck, passFail, titleOf } from './context';
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
  const shown = m2Vs(open, required);
  return makeCheck(input, {
    ruleId: req.ruleId,
    title: titleOf(input, req.ruleId, 'Open space'),
    status: passFail(open >= required),
    required: `Open ground at least ${shown.limit}: ${pct(req.share)} ${BASIS_LABEL[req.basis]} (${m2(basisArea(req, input, measured))}).`,
    actual: `${shown.value} open: the ${m2(input.site.areaM2)} plot less ${m2(measured.coverageM2)} covered by the building.`,
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
  const shown = mVs(worst.actualM, worst.setback.distanceM);
  const withinTolerance = ok && worst.actualM < worst.setback.distanceM ? `, within the ${m(SETBACK_TOLERANCE_M)} drawing tolerance` : '';
  return makeCheck(input, {
    ruleId,
    title: titleOf(input, ruleId, 'Setback'),
    status: passFail(ok),
    required: requiredText,
    actual: `Closest: ${shown.value} from edge ${siteEdgeLetter(input.site, worst.setback.edgeIndex)} (${shown.limit} required there${withinTolerance}).`,
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
  /** The plane that is lowest at `point`. */
  readonly plane: HeightPlane;
}

interface PlaneFn {
  readonly plane: HeightPlane;
  readonly fn: LinearFn;
  readonly floorM: number;
}

/** The lowest plane at a point: limit = max(linear plane, clamp floor), as in `planeLimitAt`. */
function lowestPlaneAt(fns: readonly PlaneFn[], point: Pt): { readonly plane: HeightPlane; readonly limitM: number } | null {
  let best: { readonly plane: HeightPlane; readonly limitM: number } | null = null;
  for (const { plane, fn, floorM } of fns) {
    const limitM = Math.max(fn.a * point.x + fn.b * point.y + fn.c, floorM);
    if (best === null || !(limitM >= best.limitM)) best = { plane, limitM };
  }
  return best;
}

function worstHeight(input: CheckInput, planes: readonly HeightPlane[]): Worst | null {
  const fns: PlaneFn[] = planes.map((plane) => ({ plane, fn: planeCoefficients(input.site, plane), floorM: planeFloor(plane) }));
  let worst: Worst | null = null;
  for (const floor of input.floors) {
    const topM = floor.topM + input.assumptions.parapetM;
    for (const poly of floor.outline) {
      for (const point of [poly.outer, ...poly.holes].flat()) {
        const lowest = lowestPlaneAt(fns, point);
        if (lowest === null) continue;
        const excessM = topM - lowest.limitM;
        if (worst === null || !(excessM <= worst.excessM)) {
          worst = { excessM, level: floor.level, topM, limitM: lowest.limitM, point, plane: lowest.plane };
        }
      }
    }
  }
  return worst;
}

/**
 * The road height limit, with the planes worked out afresh from the site's road edges and the
 * rule data (`heightRoads`), never from the regime's list, so a resolver error cannot pass here.
 */
function heightCheck(input: CheckInput): readonly Check[] {
  const spec = heightPlaneSpec();
  if (spec === null || !isEnabled(input, spec.meta.id)) return [];
  const planes = heightRoads(input.site, spec.slope, spec.meta.id).planes;
  const worst = worstHeight(input, planes);
  if (worst === null) return [];
  const edge = input.site.edges[worst.plane.edgeIndex];
  const depth = edge === undefined ? 0 : Math.max(0, signedDistanceToLine(worst.point, edge.from, edge.to));
  const shown = mVs(worst.topM, worst.limitM);
  const where = `at level ${worst.level}, ${m(depth)} from edge ${siteEdgeLetter(input.site, worst.plane.edgeIndex)} on the ${m(worst.plane.rowWidthM)} road (parapet top ${shown.value}, limit ${shown.limit})`;
  const ok = worst.excessM <= HEIGHT_TOLERANCE_M;
  const within = ok && worst.excessM > 0 ? `, within the ${m(HEIGHT_TOLERANCE_M)} measuring tolerance` : '';
  return [
    makeCheck(input, {
      ruleId: spec.meta.id,
      title: titleOf(input, spec.meta.id, 'Height limit from the road'),
      status: passFail(ok),
      required: `Every floor, parapet included, at most ${spec.slope} times its distance to the far side of the nearest road; every road the plot faces counts unless a wider-road exception holds for any building on the plot.`,
      actual: ok
        ? `Lowest clearance ${m(Math.max(0, -worst.excessM))}, ${where}${within}.`
        : `Over the limit by ${mVs(worst.excessM, HEIGHT_TOLERANCE_M).value}, ${where}.`,
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

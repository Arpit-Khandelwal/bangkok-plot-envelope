/** Scenario problems that stop the evaluation once the plot itself is valid. */
import { edgeLetter } from '../edgeNames';
import { findZone } from '../rules';
import type { Problem, Scenario } from '../types';

/** Accepted right-of-way widths, in metres (the same bounds as the edge form). */
export const MIN_ROAD_WIDTH_M = 1;
export const MAX_ROAD_WIDTH_M = 100;

function blocking(code: Problem['code'], message: string): Problem {
  return { code, message, blocking: true };
}

function roadProblem(scenario: Scenario): Problem | null {
  const roads = scenario.edges.flatMap((spec, i) => (spec.kind === 'road' ? [{ spec, i }] : []));
  if (roads.length === 0) {
    return blocking('no-road', 'Mark the edge that faces the road. Setbacks and the height limit are measured from it.');
  }
  const bad = roads.filter(
    ({ spec }) => !(Number.isFinite(spec.rowWidthM) && spec.rowWidthM >= MIN_ROAD_WIDTH_M && spec.rowWidthM <= MAX_ROAD_WIDTH_M),
  );
  if (bad.length === 0) return null;
  const letters = bad.map(({ i }) => edgeLetter(i)).join(', ');
  return blocking(
    'invalid-road-width',
    `Give the road width on edge ${letters} as a number between ${MIN_ROAD_WIDTH_M} and ${MAX_ROAD_WIDTH_M} m: the full right of way, from land line to land line.`,
  );
}

function zoneProblem(scenario: Scenario): Problem | null {
  const zone = scenario.zone;
  if (zone === null) {
    return blocking('outside-zone', 'This plot is not inside a zone the tool knows, so no zoning rules can be applied.');
  }
  const data = findZone(zone);
  if (data === null) {
    return blocking(
      'unsupported-zone',
      `This plot is in zone ${zone.code} of the B.E. ${zone.planVersion} plan, which this tool does not cover yet. It covers zone ย.7 of the B.E. 2556 plan.`,
    );
  }
  if (!data.buildingTypes.includes(scenario.buildingType)) {
    return blocking(
      'unsupported-zone',
      `The rules for a ${scenario.buildingType} in zone ${zone.code} are not in this tool yet.`,
    );
  }
  return null;
}

/** Road and zone problems, in the order the user should fix them. Edges are named as drawn. */
export function scenarioProblems(scenario: Scenario): readonly Problem[] {
  const road = roadProblem(scenario);
  if (road !== null) return [road];
  const zone = zoneProblem(scenario);
  return zone === null ? [] : [zone];
}

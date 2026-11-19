/** Scenario problems that stop the evaluation once the plot itself is valid. */
import { edgeLetter } from '../edgeNames';
import { findZone } from '../rules';
import type { Problem, Scenario } from '../types';

/** Accepted right-of-way widths, in metres (the same bounds as the edge form). */
export const MIN_ROAD_WIDTH_M = 1;
export const MAX_ROAD_WIDTH_M = 100;
/** Accepted waterway widths, in metres: more than 0 and at most this. */
export const MAX_WATERWAY_WIDTH_M = 200;

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

function waterwayProblem(scenario: Scenario): Problem | null {
  const bad = scenario.edges.flatMap((spec, i) =>
    spec.kind === 'waterway' && !(Number.isFinite(spec.widthM) && spec.widthM > 0 && spec.widthM <= MAX_WATERWAY_WIDTH_M) ? [i] : [],
  );
  if (bad.length === 0) return null;
  const letters = bad.map(edgeLetter).join(', ');
  return blocking(
    'invalid-waterway-width',
    `Give the waterway width on edge ${letters} as a number of metres more than 0 and at most ${MAX_WATERWAY_WIDTH_M}: the setback from a public waterway depends on it.`,
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
  const waterway = waterwayProblem(scenario);
  if (waterway !== null) return [waterway];
  const zone = zoneProblem(scenario);
  return zone === null ? [] : [zone];
}

export interface CleanScenario {
  readonly scenario: Scenario;
  /** Non-blocking problems found while cleaning, shown beside the result. */
  readonly problems: readonly Problem[];
}

/**
 * Values that cannot stop the evaluation but must not be used as given. A station distance that
 * is not a finite number of 0 m or more (NaN, negative, infinite) is treated as unknown, so the
 * station route is not applied: a negative distance would otherwise count as "within 500 m".
 */
export function cleanScenario(scenario: Scenario): CleanScenario {
  const d = scenario.stationDistanceM;
  if (d === null || (Number.isFinite(d) && d >= 0)) return { scenario, problems: [] };
  return {
    scenario: { ...scenario, stationDistanceM: null },
    problems: [
      {
        code: 'invalid-station-distance',
        message:
          'The distance to a station could not be determined from the value given, so it is treated as unknown and the station route is not applied.',
        blocking: false,
      },
    ],
  };
}

/** Checks of the road and station routes used by the plan's use tests and MR 33 access. */
import type { RoadFront } from '../context';
import type { AccessRoute } from '../data/spec';
import { m } from '../format';

export const FRONTAGE_ASSUMPTION =
  'Frontage on a road is taken as the summed length of the plot edges on that road.';

export function roadQualifies(road: RoadFront, minRowM: number, minFrontageM: number): boolean {
  return road.rowWidthM >= minRowM && road.frontageM >= minFrontageM;
}

export function routeHolds(
  route: AccessRoute,
  roads: readonly RoadFront[],
  stationDistanceM: number | null,
): boolean {
  if (route.kind === 'road') {
    return roads.some((r) => roadQualifies(r, route.minRowM, route.minFrontageM));
  }
  return stationDistanceM !== null && stationDistanceM <= route.maxDistanceM;
}

/** "a road at least 30 m wide with at least 30 m of frontage on it" */
export function describeRoute(route: AccessRoute): string {
  if (route.kind === 'road') {
    return `a road at least ${m(route.minRowM)} wide with at least ${m(route.minFrontageM)} of frontage on it`;
  }
  return `a mass-transit station platform within ${m(route.maxDistanceM)}`;
}

export function describeRoutes(routes: readonly AccessRoute[]): string {
  return routes.map(describeRoute).join(', or ');
}

/** "the 12 m road (50 m of frontage)" */
export function describeRoad(road: RoadFront): string {
  return `the ${m(road.rowWidthM)} road (${m(road.frontageM)} of frontage)`;
}

/** One sentence on how the plot does against a route. */
export function explainRoute(
  route: AccessRoute,
  roads: readonly RoadFront[],
  stationDistanceM: number | null,
): string {
  if (route.kind === 'station') {
    if (stationDistanceM === null) {
      return 'The distance to a station is unknown, so the station route is treated as not available.';
    }
    const verdict = stationDistanceM <= route.maxDistanceM ? 'within' : 'beyond';
    return `The nearest station platform is ${m(stationDistanceM)} away, ${verdict} ${m(route.maxDistanceM)}.`;
  }
  const passing = roads.find((r) => roadQualifies(r, route.minRowM, route.minFrontageM));
  if (passing !== undefined) {
    return `The road route holds: ${describeRoad(passing)} meets ${describeRoute(route)}.`;
  }
  const [only] = roads;
  const clause =
    roads.length > 1
      ? `neither ${roads.map(describeRoad).join(' nor ')} meets`
      : only === undefined
        ? 'the plot has no road that meets'
        : `${describeRoad(only)} does not meet`;
  return `The road route fails: ${clause} ${describeRoute(route)}.`;
}

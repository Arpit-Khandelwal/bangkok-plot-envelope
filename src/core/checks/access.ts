/** High-rise road access, and the station-distance caveat of the use-size test. */
import { edgeListText } from '../edgeNames';
import { accessSpec, collectRoads, useSizeSpec } from '../rules';
import type { RoadFront } from '../rules';
import type { AccessRoute } from '../rules/data/spec';
import { m, m2, m2Vs, mVs } from '../rules/format';
import type { Check } from '../types';
import { isEnabled, makeCheck, passFail, titleOf } from './context';
import type { CheckInput, Measured } from './context';

/** Station distances this close to the limit, either side, are flagged for a check on site. */
export const STATION_MARGIN_M = 40;
const ACCESS_RULE = 'mr33.access-road';
const USE_SIZE_RULE = 'plan.use-size';

function describeRoad(input: CheckInput, road: RoadFront, minFrontageM: number, minRowM: number): string {
  const frontage = mVs(road.frontageM, minFrontageM).value;
  const width = mVs(road.rowWidthM, minRowM).value;
  return `${frontage} of frontage (${edgeListText(input.site, road.edgeIndices)}) on a ${width} road`;
}

function accessChecks(input: CheckInput, measured: Measured): readonly Check[] {
  const spec = accessSpec();
  if (input.regime.regime !== 'highRise' || spec === null || !isEnabled(input, ACCESS_RULE)) return [];
  const gross = measured.sums.gross;
  const tier = spec.tiers.find((t) => t.maxGfaM2 === null || gross <= t.maxGfaM2) ?? spec.tiers[spec.tiers.length - 1];
  if (tier === undefined) return [];
  const roads = collectRoads(input.site);
  const passing = roads.find((r) => r.rowWidthM >= tier.minRowM && r.frontageM >= tier.minFrontageM);
  const best = passing ?? roads.reduce<RoadFront | undefined>((a, r) => (a === undefined || r.rowWidthM > a.rowWidthM ? r : a), undefined);
  const title = titleOf(input, ACCESS_RULE, 'Road access for a high-rise');
  const grossShown = tier.maxGfaM2 === null ? m2(gross) : m2Vs(gross, tier.maxGfaM2).value;
  return [
    makeCheck(input, {
      ruleId: ACCESS_RULE,
      title,
      status: passFail(passing !== undefined),
      required: `For ${grossShown} of floor area: at least ${m(tier.minFrontageM)} of frontage on a public road at least ${m(tier.minRowM)} wide.`,
      actual: best === undefined ? 'The plot has no road.' : `${describeRoad(input, best, tier.minFrontageM, tier.minRowM)}.`,
    }),
    makeCheck(input, {
      ruleId: ACCESS_RULE,
      title: 'Onward road connection',
      status: 'warn',
      required: `The ${m(tier.minRowM)} road must run on, unbroken, to another public road at least as wide.`,
      actual: 'Not checked by this tool: confirm the road network on site.',
    }),
  ];
}

function stationRoute(routes: readonly AccessRoute[]): Extract<AccessRoute, { kind: 'station' }> | null {
  const found = routes.find((r) => r.kind === 'station');
  return found?.kind === 'station' ? found : null;
}

function stationChecks(input: CheckInput, measured: Measured): readonly Check[] {
  const spec = useSizeSpec(input.zone, input.buildingType);
  if (spec === null || !isEnabled(input, USE_SIZE_RULE)) return [];
  const index = spec.tiers.findIndex((t) => t.anyOf.length > 0);
  const tier = spec.tiers[index];
  const route = tier === undefined ? null : stationRoute(tier.anyOf);
  if (tier === undefined || route === null) return [];
  const title = titleOf(input, USE_SIZE_RULE, 'Use-size limit');
  const d = input.stationDistanceM;
  if (d === null) {
    return [
      makeCheck(input, {
        ruleId: USE_SIZE_RULE,
        title: 'Distance to a station',
        status: 'warn',
        required: `More than the first size band needs ${m(route.maxDistanceM)} or less to a mass-transit platform, or a qualifying road.`,
        actual: 'The station route could not be assessed: the distance to a platform is unknown, so it is treated as not available.',
      }),
    ];
  }
  const roads = collectRoads(input.site);
  const roadHolds = tier.anyOf.some(
    (r) => r.kind === 'road' && roads.some((rd) => rd.rowWidthM >= r.minRowM && rd.frontageM >= r.minFrontageM),
  );
  const freeBound = spec.tiers[index - 1]?.upToM2 ?? 0;
  const countsParking = spec.measure === 'totalFloorArea' || input.reading.parkingCountsInOperatingArea;
  const area = countsParking ? measured.sums.gross : measured.sums.main;
  const relies = d > route.maxDistanceM || area > freeBound;
  if (roadHolds || !relies || Math.abs(d - route.maxDistanceM) > STATION_MARGIN_M) return [];
  return [
    makeCheck(input, {
      ruleId: USE_SIZE_RULE,
      title,
      status: 'warn',
      required: `A mass-transit platform within ${m(route.maxDistanceM)} allows more than ${m2(freeBound)}.`,
      actual: `Check on site: the distance to the platform is ${mVs(d, route.maxDistanceM, 0).value}, close to the ${m(route.maxDistanceM)} limit.`,
    }),
  ];
}

export function accessAndStationChecks(input: CheckInput, measured: Measured): readonly Check[] {
  return [...accessChecks(input, measured), ...stationChecks(input, measured)];
}

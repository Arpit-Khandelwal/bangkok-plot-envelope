import type { BuildingType, RegimeId, Scenario, Site } from '../types';
import { roadFrontage } from './frontage';

/** One road the plot touches, with all its edges gathered. */
export interface RoadFront {
  readonly roadId: string;
  /** Narrowest right-of-way given on any of its edges (they should agree). */
  readonly rowWidthM: number;
  /** Longest straight run of the plot along this road (see `roadFrontage`). */
  readonly frontageM: number;
  readonly edgeIndices: readonly number[];
}

/** Everything a rule resolver may read. Built once per regime. */
export interface RuleContext {
  readonly site: Site;
  readonly regime: RegimeId;
  readonly buildingType: BuildingType;
  readonly stationDistanceM: number | null;
  readonly parkingCountsInFar: boolean;
  readonly officeParkingCountsInOperatingArea: boolean;
  /** Assumed height of parapet and rooftop structure above the roof deck (a developer norm). */
  readonly parapetM: number;
  readonly roads: readonly RoadFront[];
}

export function collectRoads(site: Site): readonly RoadFront[] {
  const byId = new Map<string, RoadFront>();
  for (const edge of site.edges) {
    const spec = edge.spec;
    if (spec.kind !== 'road') continue;
    const prev = byId.get(spec.roadId);
    byId.set(spec.roadId, {
      roadId: spec.roadId,
      rowWidthM: prev === undefined ? spec.rowWidthM : Math.min(prev.rowWidthM, spec.rowWidthM),
      frontageM: prev?.frontageM ?? roadFrontage(site, spec.roadId),
      edgeIndices: [...(prev?.edgeIndices ?? []), edge.index],
    });
  }
  return [...byId.values()];
}

export function buildContext(site: Site, scenario: Scenario, regime: RegimeId): RuleContext {
  return {
    site,
    regime,
    buildingType: scenario.buildingType,
    stationDistanceM: scenario.stationDistanceM,
    parkingCountsInFar: scenario.interpretation.parkingCountsInFar,
    officeParkingCountsInOperatingArea: scenario.interpretation.officeParkingCountsInOperatingArea,
    parapetM: scenario.assumptions.parapetM,
    roads: collectRoads(site),
  };
}

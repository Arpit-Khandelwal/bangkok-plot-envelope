/** Scenarios for the end-to-end tests: plots drawn in local metres, converted to lng/lat. */
import { makeFrame, toLngLat } from '../geom';
import type { BuildingType, Design, EdgeSpec, Evaluation, LngLat, Pt, Scenario } from '../types';

/** A point in Bangkok (Sukhumvit, zone ย.7). */
const ORIGIN: LngLat = [100.609, 13.689];
const FRAME = makeFrame([ORIGIN]);

export const NEIGHBOUR: EdgeSpec = { kind: 'neighbour' };

export function road(rowWidthM: number, roadId = 'road-1'): EdgeSpec {
  return { kind: 'road', roadId, rowWidthM };
}

export function plotOf(points: readonly Pt[]): LngLat[] {
  return points.map((p) => toLngLat(FRAME, p));
}

/** w x d rectangle, counter-clockwise from the south-west corner; edge 0 is the south side. */
export function rect(w: number, d: number): Pt[] {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ];
}

export interface ScenarioOptions {
  readonly buildingType?: BuildingType;
  readonly stationDistanceM?: number | null;
  readonly disabledRuleIds?: readonly string[];
  readonly zone?: Scenario['zone'];
  readonly parkingCountsInFar?: boolean;
  readonly officeParkingCountsInOperatingArea?: boolean;
  readonly frontOpenSpaceOnPublicRoad?: boolean;
  readonly floorToFloorM?: number;
}

/** The app defaults (src/state/defaults.ts) for each building type. */
const ASSUMPTIONS: Readonly<Record<BuildingType, Scenario['assumptions']>> = {
  condo: {
    floorToFloorM: 3.1,
    parkingFloorToFloorM: 3,
    efficiency: 0.7,
    averageUnitM2: 35,
    shareOfUnitsOver60M2: 0.15,
    parkingM2PerStall: 28,
    parapetM: 1.2,
  },
  office: {
    floorToFloorM: 3.8,
    parkingFloorToFloorM: 3,
    efficiency: 0.8,
    averageUnitM2: 250,
    shareOfUnitsOver60M2: 0,
    parkingM2PerStall: 28,
    parapetM: 1.2,
  },
};

export function scenario(points: readonly Pt[], edges: readonly EdgeSpec[], options: ScenarioOptions = {}): Scenario {
  const type = options.buildingType ?? 'condo';
  const base = ASSUMPTIONS[type];
  return {
    plot: plotOf(points),
    edges,
    buildingType: type,
    zone: options.zone === undefined ? { code: 'ย.7', planVersion: '2556' } : options.zone,
    stationDistanceM: options.stationDistanceM === undefined ? 300 : options.stationDistanceM,
    assumptions: { ...base, floorToFloorM: options.floorToFloorM ?? base.floorToFloorM },
    interpretation: {
      parkingCountsInFar: options.parkingCountsInFar ?? true,
      officeParkingCountsInOperatingArea: options.officeParkingCountsInOperatingArea ?? true,
      frontOpenSpaceOnPublicRoad: options.frontOpenSpaceOnPublicRoad ?? false,
    },
    disabledRuleIds: options.disabledRuleIds ?? [],
  };
}

export type OkEvaluation = Extract<Evaluation, { ok: true }>;

export function expectOk(evaluation: Evaluation): OkEvaluation {
  if (!evaluation.ok) throw new Error(`expected ok, got ${evaluation.problems.map((p) => p.message).join(' | ')}`);
  return evaluation;
}

export function designById(evaluation: OkEvaluation, id: string): Design {
  const found = evaluation.designs.find((d) => d.id === id);
  if (found === undefined) throw new Error(`no design ${id}; have ${evaluation.designs.map((d) => d.id).join(', ')}`);
  return found;
}

/** Hand-built sites and scenarios for the rules tests. Not used by production code. */
import type { BuildingType, EdgeSpec, Pt, RegimeId, RegimeRules, Scenario, Site } from '../types';
import { resolveRules } from './resolve';

export const NEIGHBOUR: EdgeSpec = { kind: 'neighbour' };

export function road(rowWidthM: number, roadId = 'A'): EdgeSpec {
  return { kind: 'road', roadId, rowWidthM };
}

export function waterway(widthM: number): EdgeSpec {
  return { kind: 'waterway', widthM };
}

/**
 * Axis-aligned rectangle, counter-clockwise from the origin.
 * Edge 0 is the bottom (length w), 1 the right (d), 2 the top (w), 3 the left (d).
 */
export function rectSite(w: number, d: number, specs: readonly [EdgeSpec, EdgeSpec, EdgeSpec, EdgeSpec]): Site {
  const ring: readonly Pt[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ];
  const lengths = [w, d, w, d];
  const edges = specs.map((spec, index) => {
    const from = ring[index] ?? { x: 0, y: 0 };
    const to = ring[(index + 1) % ring.length] ?? { x: 0, y: 0 };
    return { index, sourceIndex: index, spec, lengthM: lengths[index] ?? 0, from, to };
  });
  return {
    frame: { origin: [100.6, 13.7] },
    ring,
    areaM2: w * d,
    perimeterM: 2 * (w + d),
    edges,
  };
}

/** A w x d plot with one road on edge 0 and neighbours elsewhere. */
export function frontedSite(w: number, d: number, rowWidthM: number): Site {
  return rectSite(w, d, [road(rowWidthM), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]);
}

export interface ScenarioOptions {
  readonly buildingType?: BuildingType;
  readonly stationDistanceM?: number | null;
  readonly disabledRuleIds?: readonly string[];
  readonly zone?: Scenario['zone'];
  readonly parkingCountsInFar?: boolean;
  readonly officeParkingCountsInOperatingArea?: boolean;
}

export function scenarioFor(site: Site, options: ScenarioOptions = {}): Scenario {
  return {
    plot: site.ring.map((p): readonly [number, number] => [p.x, p.y]),
    edges: site.edges.map((e) => e.spec),
    buildingType: options.buildingType ?? 'condo',
    zone: options.zone === undefined ? { code: 'ย.7', planVersion: '2556' } : options.zone,
    stationDistanceM: options.stationDistanceM === undefined ? null : options.stationDistanceM,
    assumptions: {
      floorToFloorM: 3,
      parkingFloorToFloorM: 3,
      efficiency: 0.65,
      averageUnitM2: 35,
      shareOfUnitsOver60M2: 0.1,
      parkingM2PerStall: 27,
      parapetM: 3,
    },
    interpretation: {
      parkingCountsInFar: options.parkingCountsInFar ?? true,
      officeParkingCountsInOperatingArea: options.officeParkingCountsInOperatingArea ?? true,
    },
    disabledRuleIds: options.disabledRuleIds ?? [],
  };
}

export function resolve(site: Site, options: ScenarioOptions = {}): Record<RegimeId, RegimeRules> {
  return resolveRules(site, scenarioFor(site, options));
}

export function ruleOf(rules: RegimeRules, id: string): RegimeRules['rules'][number] {
  const found = rules.rules.find((r) => r.id === id);
  if (found === undefined) throw new Error(`rule ${id} not in ${rules.regime}`);
  return found;
}

export function bindingIds(rules: RegimeRules): readonly string[] {
  return rules.rules.filter((r) => r.binding).map((r) => r.id);
}

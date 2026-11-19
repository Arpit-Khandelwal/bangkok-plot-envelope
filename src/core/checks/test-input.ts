/** Builds a CheckInput for tests: the rules of one regime of an evaluated scenario, with given floors. */
import { areaReading } from '../designs/context';
import { evaluate } from '../evaluate';
import { expectOk } from '../pipeline/test-scenarios';
import type { Floor, Region, RegimeId, Scenario } from '../types';
import { regionArea } from '../geom';
import type { CheckInput } from './context';

export function checkInputFor(scenario: Scenario, regime: RegimeId, floors: readonly Floor[]): CheckInput {
  const e = expectOk(evaluate(scenario));
  return {
    site: e.site,
    regime: e.regimes[regime].rules,
    floors,
    assumptions: scenario.assumptions,
    enteredFloorToFloorM: scenario.assumptions.floorToFloorM,
    buildingType: scenario.buildingType,
    zone: scenario.zone,
    stationDistanceM: scenario.stationDistanceM,
    reading: areaReading(scenario),
    disabledRuleIds: new Set(scenario.disabledRuleIds),
    frontOpenSpaceOnPublicRoad: scenario.interpretation.frontOpenSpaceOnPublicRoad,
  };
}

/** `count` storeys of one use on the same outline, 3 m each. */
export function floorsOf(outline: Region, count: number, use: Floor['use'] = 'residential'): Floor[] {
  return Array.from({ length: count }, (_, i) => ({
    level: i + 1,
    use,
    baseM: 3 * i,
    topM: 3 * (i + 1),
    outline,
    areaM2: regionArea(outline),
  }));
}

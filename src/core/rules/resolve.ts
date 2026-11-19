import type { RegimeId, RegimeRules, Scenario, Site } from '../types';
import { aggregate, maxTotalFloorArea, NO_PARKING, type ResolvedRule } from './aggregate';
import { buildContext, collectRoads } from './context';
import { BLOCK_NO_ROAD, BLOCK_ZONE_UNSUPPORTED, BUILDING_CONTROL_RULES, findZone, rulesFor, ZONES } from './data';
import type { RuleSpec, ZoneData } from './data/spec';
import { resolveSpec } from './kinds';

function unavailable(regime: RegimeId, blockId: string): RegimeRules {
  return {
    regime,
    available: false,
    blockedBy: [blockId],
    setbacks: [],
    heightPlanes: [],
    roofDeckCapM: null,
    roofDeckCapRuleId: null,
    gfaLimits: [],
    maxGfaM2: 0,
    bindingGfaRuleId: blockId,
    maxMainUseM2: null,
    openSpace: [],
    parking: NO_PARKING,
    minFloorToFloorM: 0,
    rules: [],
  };
}

function bothUnavailable(blockId: string): Record<RegimeId, RegimeRules> {
  return { lowRise: unavailable('lowRise', blockId), highRise: unavailable('highRise', blockId) };
}

function resolveRegime(
  site: Site,
  scenario: Scenario,
  zone: ZoneData,
  buildingControl: readonly RuleSpec[],
  regime: RegimeId,
): RegimeRules {
  const specs: readonly RuleSpec[] = rulesFor(zone, regime, scenario.buildingType, buildingControl);
  const context = buildContext(site, scenario, regime);
  const disabled = new Set(scenario.disabledRuleIds);
  const run = (maxGfaM2: number | null): readonly ResolvedRule[] =>
    specs.map((spec) => ({
      spec,
      resolution: resolveSpec(spec, { ...context, maxGfaM2 }),
      disabled: disabled.has(spec.meta.id),
    }));
  // First pass finds the floor-area cap; the second lets rules quote it in their wording.
  const maxGfaM2 = maxTotalFloorArea(run(null));
  return aggregate(site, regime, run(maxGfaM2), context.parapetM);
}

/**
 * Resolves the rule data for both regimes on this plot. Never throws: an unknown zone or a plot
 * with no road gives two unavailable regimes.
 */
export function resolveRules(site: Site, scenario: Scenario): Record<RegimeId, RegimeRules> {
  return resolveRulesWith(site, scenario, ZONES, BUILDING_CONTROL_RULES);
}

/** As `resolveRules`, with the rule data passed in: a new zone or rule needs no code change. */
export function resolveRulesWith(
  site: Site,
  scenario: Scenario,
  zones: readonly ZoneData[],
  buildingControl: readonly RuleSpec[],
): Record<RegimeId, RegimeRules> {
  const zone = findZone(scenario.zone, zones);
  if (zone === null || !zone.buildingTypes.includes(scenario.buildingType)) {
    return bothUnavailable(BLOCK_ZONE_UNSUPPORTED);
  }
  if (collectRoads(site).length === 0) return bothUnavailable(BLOCK_NO_ROAD);
  return {
    lowRise: resolveRegime(site, scenario, zone, buildingControl, 'lowRise'),
    highRise: resolveRegime(site, scenario, zone, buildingControl, 'highRise'),
  };
}

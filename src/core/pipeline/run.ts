/** The evaluation once the site and the scenario are valid: rules, envelopes, designs. */
import { areaReading, designContext } from '../designs/context';
import type { DesignContext } from '../designs/context';
import { generateDesigns } from '../designs/variants';
import { planFarRatio, resolveRules } from '../rules';
import type { Evaluation, Problem, RegimeId, RegimeResult, RegimeRules, Scenario, Site } from '../types';
import { saneAssumptions } from './assumptions';
import { withActualBinding } from './binding';
import { heightOffProblem, nothingBuildableProblem, regimeEnvelope } from './envelopes';

const REGIMES: readonly RegimeId[] = ['lowRise', 'highRise'];

const TOO_SMALL =
  'the plate left after the setbacks and open space is too small to hold its floors together with the parking they need';

function fewDesignsProblem(count: number): Problem | null {
  if (count >= 2) return null;
  const message =
    count === 0
      ? `The allowed space exists, but no concept design passes every rule in it: ${TOO_SMALL}. Try a larger plot, or switch rules off to explore.`
      : `Only one concept design passes every rule here: on a smaller plate, ${TOO_SMALL}.`;
  return { code: 'no-design', message, blocking: false };
}

export function runEvaluation(site: Site, scenario: Scenario): Evaluation {
  const resolved = resolveRules(site, scenario);
  const envelopes = { lowRise: regimeEnvelope(site, resolved.lowRise), highRise: regimeEnvelope(site, resolved.highRise) };
  if (envelopes.lowRise === null && envelopes.highRise === null) {
    return { ok: false, site, problems: [nothingBuildableProblem(site, [resolved.lowRise, resolved.highRise])] };
  }
  const sane = saneAssumptions(scenario.assumptions);
  const assumptions = sane.assumptions;
  const contextOf = (regime: RegimeId): DesignContext | null => {
    const env = envelopes[regime];
    return env === null ? null : designContext(site, scenario, assumptions, resolved[regime], env);
  };
  const hypothetical = scenario.disabledRuleIds.length > 0;
  const reading = areaReading(scenario);
  const set = generateDesigns({
    contexts: { lowRise: contextOf('lowRise'), highRise: contextOf('highRise') },
    base: {
      site,
      assumptions,
      enteredFloorToFloorM: scenario.assumptions.floorToFloorM,
      buildingType: scenario.buildingType,
      zone: scenario.zone,
      stationDistanceM: scenario.stationDistanceM,
      reading,
      disabledRuleIds: new Set(scenario.disabledRuleIds),
    },
    allowedFar: planFarRatio(scenario.zone, scenario.buildingType),
    hypothetical,
  });
  const result = (regime: RegimeId): RegimeResult => {
    const rules: RegimeRules = withActualBinding(resolved[regime], set.stops[regime], reading);
    return { rules, envelope: envelopes[regime] };
  };
  const problems: Problem[] = [
    ...sane.problems,
    ...REGIMES.flatMap((r) => {
      const p = heightOffProblem(resolved[r]);
      return p === null ? [] : [p];
    }),
    ...[fewDesignsProblem(set.designs.length)].filter((p): p is Problem => p !== null),
  ];
  return {
    ok: true,
    site,
    problems,
    hypothetical,
    regimes: { lowRise: result('lowRise'), highRise: result('highRise') },
    designs: set.designs,
  };
}

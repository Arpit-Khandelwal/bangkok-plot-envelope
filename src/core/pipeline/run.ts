/** The evaluation once the site and the scenario are valid: rules, envelopes, designs. */
import { areaReading, designContext, setBackContext } from '../designs/context';
import { chooseForms } from '../designs/forms';
import type { SetBackStatus } from '../designs/forms';
import { onPublicRoad } from '../designs/front-rule';
import type { DesignContext } from '../designs/context';
import { largestPiece, regionWidth } from '../geom';
import { m } from '../rules/format';
import { generateDesigns } from '../designs/variants';
import { generateVariant } from '../designs/generate';
import { nonDefaultReadings } from '../readings';
import { planFarRatio, resolveRules } from '../rules';
import type { Evaluation, Problem, RegimeId, RegimeResult, RegimeRules, Scenario, Site } from '../types';
import { saneAssumptions } from './assumptions';
import { withActualBinding } from './binding';
import { heightOffProblem, nothingBuildableProblem, regimeEnvelope } from './envelopes';

const REGIMES: readonly RegimeId[] = ['lowRise', 'highRise'];
/** Form B is not tried when the on-road design is within this share of the floor-area cap. */
const SET_BACK_GAIN_SHARE = 0.01;

/** Forms apply where the front-access rule is on and the plot's allowed plate can stand on the road. */
function formsOn(site: Site, regime: RegimeRules): boolean {
  return regime.rules.some((r) => r.id === 'bma.front-access' && !r.disabled) && onPublicRoad(site, regime);
}

const TOO_SMALL =
  'the plate left after the setbacks and open space is too small to hold its floors together with the parking they need';

/** Widths are reported to this step ("about 6 m wide"). */
const WIDTH_STEP_M = 0.5;

/**
 * The plain reason when no design is possible because every allowed footprint is too narrow for a
 * usable floor; null when some regime has a habitable plate.
 */
function tooNarrowProblem(contexts: readonly (DesignContext | null)[]): Problem | null {
  const present = contexts.filter((c): c is DesignContext => c !== null);
  if (present.length === 0 || present.some((c) => c.basePlate.length > 0)) return null;
  const widest = Math.max(...present.map((c) => regionWidth(largestPiece(c.envelope.footprint))));
  const shown = m(Math.round(widest / WIDTH_STEP_M) * WIDTH_STEP_M);
  return {
    code: 'no-design',
    message: `The buildable part of this plot is only about ${shown} wide after setbacks, too narrow for a usable floor.`,
    blocking: false,
  };
}

function fewDesignsProblem(count: number, contexts: readonly (DesignContext | null)[]): Problem | null {
  if (count >= 2) return null;
  const narrow = count === 0 ? tooNarrowProblem(contexts) : null;
  if (narrow !== null) return narrow;
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
  const contexts = { lowRise: contextOf('lowRise'), highRise: contextOf('highRise') };
  const inputs = {
    base: {
      site,
      assumptions,
      enteredFloorToFloorM: scenario.assumptions.floorToFloorM,
      buildingType: scenario.buildingType,
      zone: scenario.zone,
      stationDistanceM: scenario.stationDistanceM,
      reading,
      disabledRuleIds: new Set(scenario.disabledRuleIds),
      frontOpenSpaceOnPublicRoad: scenario.interpretation.frontOpenSpaceOnPublicRoad,
    },
    allowedFar: planFarRatio(scenario.zone, scenario.buildingType),
    hypothetical,
  };
  const onRoadSet = generateDesigns({ ...inputs, contexts });
  // Form B is tried only for a regime whose largest on-road design ends more than 1% short of the
  // regime's floor-area cap (one at the cap cannot be beaten by more than that), and only when its
  // own largest design, built first as a probe, has more floor area than the on-road one.
  const setBackOf = (regime: RegimeId): { readonly ctx: DesignContext | null; readonly status: SetBackStatus } => {
    const env = envelopes[regime];
    const stop = onRoadSet.stops[regime];
    if (env === null) return { ctx: null, status: { kind: 'impossible' } };
    if (stop !== null && stop.sums.gross >= (1 - SET_BACK_GAIN_SHARE) * resolved[regime].maxGfaM2) return { ctx: null, status: { kind: 'atCap' } };
    const ctx = setBackContext(site, scenario, assumptions, resolved[regime], env);
    const probe = ctx === null ? null : generateVariant(ctx, { plateAreaM2: Number.POSITIVE_INFINITY });
    if (probe === null) return { ctx: null, status: { kind: 'impossible' } };
    if (probe.stack.sums.gross <= (stop?.sums.gross ?? 0)) return { ctx: null, status: { kind: 'smaller', grossM2: probe.stack.sums.gross } };
    return { ctx, status: { kind: 'generated' } };
  };
  const formsApply = !scenario.interpretation.frontOpenSpaceOnPublicRoad && REGIMES.some((r) => contexts[r] !== null && formsOn(site, resolved[r]));
  const lowB = formsApply ? setBackOf('lowRise') : null;
  const highB = formsApply ? setBackOf('highRise') : null;
  const setBack = { lowRise: lowB?.ctx ?? null, highRise: highB?.ctx ?? null };
  const anySetBack = setBack.lowRise !== null || setBack.highRise !== null;
  const set = chooseForms({
    onRoad: onRoadSet,
    setBack: anySetBack ? generateDesigns({ ...inputs, contexts: setBack }) : null,
    status: lowB === null || highB === null ? null : { lowRise: lowB.status, highRise: highB.status },
    site,
  });
  const result = (regime: RegimeId): RegimeResult => {
    const rules: RegimeRules = withActualBinding(resolved[regime], set.stops[regime], reading);
    return { rules, envelope: envelopes[regime] };
  };
  const problems: Problem[] = [
    ...sane.problems,
    ...set.problems,
    ...REGIMES.flatMap((r) => {
      const p = heightOffProblem(resolved[r]);
      return p === null ? [] : [p];
    }),
    ...[fewDesignsProblem(set.designs.length, [contexts.lowRise, contexts.highRise])].filter((p): p is Problem => p !== null),
  ];
  return {
    ok: true,
    site,
    problems,
    hypothetical,
    nonDefaultReadings: nonDefaultReadings(scenario.interpretation),
    regimes: { lowRise: result('lowRise'), highRise: result('highRise') },
    designs: set.designs,
  };
}

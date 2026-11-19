import { buildSite } from './geom';
import { cleanScenario, scenarioProblems } from './pipeline/inputs';
import { runEvaluation } from './pipeline/run';
import type { Evaluation, Scenario } from './types';

/**
 * The whole pipeline: Scenario in, Evaluation out. Pure and synchronous, never throws.
 *
 * 1. Build the site from the drawn plot; invalid plots stop here with `site: null`.
 * 2. Road and zone problems stop here, with the site, so its area and edges can still be shown.
 * 3. Unusable values that need not stop the evaluation (a bad station distance) are cleaned,
 *    with a non-blocking problem.
 * 4. Resolve the rules, build each regime's envelope, generate and check the designs.
 */
export function evaluate(scenario: Scenario): Evaluation {
  const built = buildSite(scenario.plot, scenario.edges);
  if (!built.ok) return { ok: false, site: null, problems: built.problems };
  const problems = scenarioProblems(scenario);
  if (problems.length > 0) return { ok: false, site: built.site, problems };
  const clean = cleanScenario(scenario);
  const result = runEvaluation(built.site, clean.scenario);
  return clean.problems.length === 0 ? result : { ...result, problems: [...clean.problems, ...result.problems] };
}

import { buildSite } from './geom';
import { scenarioProblems } from './pipeline/inputs';
import { runEvaluation } from './pipeline/run';
import type { Evaluation, Scenario } from './types';

/**
 * The whole pipeline: Scenario in, Evaluation out. Pure and synchronous, never throws.
 *
 * 1. Build the site from the drawn plot; invalid plots stop here with `site: null`.
 * 2. Road and zone problems stop here, with the site, so its area and edges can still be shown.
 * 3. Resolve the rules, build each regime's envelope, generate and check the designs.
 */
export function evaluate(scenario: Scenario): Evaluation {
  const built = buildSite(scenario.plot, scenario.edges);
  if (!built.ok) return { ok: false, site: null, problems: built.problems };
  const problems = scenarioProblems(scenario);
  if (problems.length > 0) return { ok: false, site: built.site, problems };
  return runEvaluation(built.site, scenario);
}

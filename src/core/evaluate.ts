import type { Evaluation, Scenario } from './types';

/**
 * The whole pipeline: Scenario in, Evaluation out. Pure and synchronous.
 * Placeholder until the geometry and rules modules are integrated.
 */
export function evaluate(_scenario: Scenario): Evaluation {
  return {
    ok: false,
    site: null,
    problems: [{ code: 'nothing-buildable', message: 'The evaluation pipeline is not connected yet.', blocking: true }],
  };
}

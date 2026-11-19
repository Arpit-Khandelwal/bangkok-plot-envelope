import { describe, expect, it } from 'vitest';
import type { Evaluation, Problem } from '../core/types';
import type { ZoneLookup } from '../site/context';
import { withGeometryPrecedence } from './useEvaluation';
import type { EvaluationView } from './useEvaluation';

const OUTSIDE: ZoneLookup = { status: 'outside' };

function viewWith(problems: readonly Problem[]): EvaluationView {
  const evaluation: Evaluation = { ok: false, site: null, problems };
  return { evaluation, zoneLookup: OUTSIDE, station: null, dataStatus: { state: 'ready' } };
}

describe('withGeometryPrecedence', () => {
  it('drops the zone lookup and marks the zone as not checked when the outline is unusable', () => {
    const view = withGeometryPrecedence(viewWith([{ code: 'self-intersecting', message: 'Crosses.', blocking: true }]));
    expect(view.zoneLookup).toBeNull();
    expect(view.dataStatus).toEqual({ state: 'not-checked' });
  });

  it('leaves the view alone for any other problem', () => {
    const original = viewWith([{ code: 'no-road', message: 'Mark the road.', blocking: true }]);
    expect(withGeometryPrecedence(original)).toBe(original);
  });
});

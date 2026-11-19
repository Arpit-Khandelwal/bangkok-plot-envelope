import { describe, expect, it } from 'vitest';
import type { Problem, ProblemCode } from '../core/types';
import { hasGeometryProblem, hasNoUsableArea } from './geometryProblem';

const problem = (code: ProblemCode, blocking = true): Problem => ({ code, message: code, blocking });

describe('hasGeometryProblem', () => {
  it.each(['too-few-points', 'self-intersecting', 'zero-area', 'too-small', 'too-large', 'invalid-coordinates', 'edges-mismatch'] as const)(
    'is true for %s',
    (code) => expect(hasGeometryProblem([problem(code)])).toBe(true),
  );

  it.each(['no-road', 'invalid-road-width', 'outside-zone', 'unsupported-zone', 'nothing-buildable'] as const)(
    'is false for %s',
    (code) => expect(hasGeometryProblem([problem(code)])).toBe(false),
  );

  it('is false for no problems, and for a geometry code that is not blocking', () => {
    expect(hasGeometryProblem(null)).toBe(false);
    expect(hasGeometryProblem([])).toBe(false);
    expect(hasGeometryProblem([problem('too-small', false)])).toBe(false);
  });
});

describe('hasNoUsableArea', () => {
  it('is true when the area would read as zero or nonsense, false when the outline is only too small or large', () => {
    expect(hasNoUsableArea([problem('self-intersecting')])).toBe(true);
    expect(hasNoUsableArea([problem('zero-area')])).toBe(true);
    expect(hasNoUsableArea([problem('too-small')])).toBe(false);
    expect(hasNoUsableArea([problem('no-road')])).toBe(false);
  });
});

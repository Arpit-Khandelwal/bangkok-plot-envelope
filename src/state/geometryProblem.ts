import type { Problem, ProblemCode } from '../core/types';

/** Problems with the drawn outline itself, as opposed to the road, the zone or the rules. */
const GEOMETRY_CODES: ReadonlySet<ProblemCode> = new Set<ProblemCode>([
  'too-few-points',
  'self-intersecting',
  'zero-area',
  'too-small',
  'too-large',
  'invalid-coordinates',
  'edges-mismatch',
]);

/** Geometry problems after which the outline has no area worth quoting. */
const NO_AREA_CODES: ReadonlySet<ProblemCode> = new Set<ProblemCode>([
  'too-few-points',
  'self-intersecting',
  'zero-area',
  'invalid-coordinates',
]);

/** True when a blocking problem says the outline itself is unusable. Then nothing about zones or roads applies. */
export function hasGeometryProblem(problems: readonly Problem[] | null | undefined): boolean {
  return problems?.some((problem) => problem.blocking && GEOMETRY_CODES.has(problem.code)) ?? false;
}

/** True when the outline is unusable in a way that makes its area meaningless (a bow-tie reads 0 m²). */
export function hasNoUsableArea(problems: readonly Problem[] | null | undefined): boolean {
  return problems?.some((problem) => problem.blocking && NO_AREA_CODES.has(problem.code)) ?? false;
}

/** Public API of the geometry core: pure functions in local metres (x east, y north, z up). */
export { makeFrame, metresPerDegree, toLngLat, toLocal } from './frame';
export {
  centroid,
  distanceToSegment,
  isSimple,
  perimeter,
  pointInRing,
  removeDuplicatePoints,
  segmentDistance,
  signedArea,
  signedDistanceToLine,
} from './ring';
export { buildSite } from './site';
export type { BuildSiteResult } from './site';
export {
  clipHalfPlane,
  difference,
  insetUniform,
  intersection,
  largestPiece,
  minDistanceToSegment,
  pointInRegion,
  regionArea,
  regionBounds,
  union,
  unionAll,
} from './region';
export type { Bounds } from './region';
export { applySetbacks, setbackDistances } from './setbacks';
export { heightLimitAt, planeCoefficients, planeFloor, sliceAtHeight } from './height';
export type { LinearFn } from './height';
export { buildEnvelope } from './envelope';
export { extrudeRegion, mergeMeshes } from './mesh';
export * as tolerances from './tolerance';

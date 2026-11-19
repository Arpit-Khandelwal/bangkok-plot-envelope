/**
 * Numeric tolerances for the geometry core. All lengths in metres, areas in m2.
 *
 * Clipping runs on an integer grid of CLIPPER_SCALE units per metre (1 mm). Every
 * region that comes out of `region.ts` has its vertices on that grid, so a vertex
 * is within half a millimetre of its exact position. Coordinates stay well under
 * 1e7 grid units (10 km) for any plot we accept, which keeps the cross products
 * inside the exact-integer range of a double (2^53).
 */

/** Integer grid units per metre used for clipping (millimetre precision). */
export const CLIPPER_SCALE = 1000;

/** Pieces and holes smaller than this are dropped from clipping results as slivers. */
export const SLIVER_AREA_M2 = 0.01;

/**
 * Round setback ends are approximated by a polygon that circumscribes the true arc,
 * so the approximation never lets a building closer than the setback. The polygon
 * overshoots the arc by at most this much.
 */
export const ARC_TOLERANCE_M = 0.02;

/** Consecutive plot corners closer than this are treated as one corner. */
export const DUPLICATE_POINT_M = 0.01;

/** Non-adjacent plot edges closer than this are treated as touching (not simple). */
export const TOUCH_TOLERANCE_M = 0.001;

/** A plot whose corners all lie within this distance of one line has no area. */
export const COLLINEAR_TOLERANCE_M = 0.01;

/** Plots with less area than this are treated as having no area at all. */
export const ZERO_AREA_M2 = 0.01;

/** Smallest and largest plot areas the tool accepts. */
export const MIN_PLOT_AREA_M2 = 40;
export const MAX_PLOT_AREA_M2 = 400_000;

/** Heights below this are treated as zero when building walls. */
export const ZERO_HEIGHT_M = 1e-6;

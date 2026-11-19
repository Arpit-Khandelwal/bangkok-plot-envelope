/**
 * Where the plate may sit so the design meets the front-access clause that governs it (see
 * `front-rule.ts`, DECISIONS.md B12).
 *  - On a public road, default reading (clause 53): the plate stays at the road setback; on a deep
 *    plot with a narrow frontage it is cut short so its road-facing side exceeds an eighth of its
 *    perimeter.
 *  - On a public road, stricter reading (clause 52(6)): the footprint loses a 12 m strip along the
 *    governing road edge (the width over 3 storeys, which covers the 6 m asked of lower buildings);
 *    failing that, along another edge; failing that, the plate is cut short for clause 53.
 *  - Not on a public road (a flag plot): the 12 m strip along whichever edge leaves the largest
 *    plate with the open space, linked to the road through the access.
 */
import { clipHalfPlane, difference, largestPiece, regionArea } from '../geom';
import { FRONT_FACADE_SHARE, frontAccess, FRONT_FACADE_MAX_M } from '../measure/front-access';
import { frontOpenSpace, FRONT_OPEN_SPACE_TALL_M } from '../measure/front-open-space';
import type { EdgeInfo, Region, RegimeRules, Site } from '../types';
import { onPublicRoad } from './front-rule';
import { habitable, MIN_MAIN_WIDTH_M } from './habitable';
import { governingEdgeOf, inwardLine } from './road-edge';

const FRONT_ACCESS_RULE = 'bma.front-access';
/**
 * The depth cut for clause 53 aims at this multiple of the façade share, since sizing the plate for
 * open space later shrinks it and the share with it.
 */
const CLAUSE_53_MARGIN = 1.25;
/** Only the longest few other edges are tried for the strip, so a plot of many corners stays fast. */
const MAX_OTHER_EDGES = 6;
/** An edge shorter than this is not tried for the strip: too short to front a building. */
const MIN_FRONT_EDGE_M = 6;
/** The shallowest depth cut tried, in usable floor widths behind the strip. */
const MIN_DEPTH_WIDTHS = 2;
/** Depth cuts are found to within this distance, in at most this many steps. */
const DEPTH_PRECISION_M = 0.25;
const DEPTH_MAX_STEPS = 30;

export interface FrontPlate {
  /** The largest piece of the allowed footprint left for the building. */
  readonly whole: Region;
  /** `whole` with every part too narrow for a floor removed. */
  readonly basePlate: Region;
  /** The part of the allowed footprint too narrow for a floor, whether or not the strip took it. */
  readonly tooNarrow: Region;
}

interface Piece {
  readonly whole: Region;
  readonly basePlate: Region;
}

function plateOn(region: Region): Piece {
  const whole = largestPiece(region);
  return { whole, basePlate: habitable(whole, MIN_MAIN_WIDTH_M) };
}

function withNarrow(p: Piece, plain: Piece): FrontPlate {
  return { ...p, tooNarrow: difference(plain.whole, plain.basePlate) };
}

/** The footprint at least `depthM` from the line of `edge`, on the plot side, or null for a degenerate edge. */
function beyond(footprint: Region, edge: EdgeInfo, depthM: number): Region | null {
  const line = inwardLine(edge);
  return line === null ? null : clipHalfPlane(footprint, line.n.x, line.n.y, -line.k - depthM);
}

/** The footprint at most `depthM` from the line of `edge`. */
function within(footprint: Region, edge: EdgeInfo, depthM: number): Region {
  const line = inwardLine(edge);
  return line === null ? footprint : clipHalfPlane(footprint, -line.n.x, -line.n.y, line.k + depthM);
}

function hasOpenSpace(site: Site, plate: Region): boolean {
  return plate.length > 0 && frontOpenSpace(site, plate, FRONT_OPEN_SPACE_TALL_M).meets;
}

function meets53WithMargin(site: Site, plate: Region): boolean {
  if (plate.length === 0) return false;
  const fa = frontAccess(site, plate);
  return fa.nearestM <= FRONT_FACADE_MAX_M && fa.facingM > CLAUSE_53_MARGIN * FRONT_FACADE_SHARE * fa.perimeterM;
}

/**
 * The strip along each of the longest edges (but `exclude`); the largest plate with the open space.
 * Candidates are first judged before the narrow parts are removed, then opened, largest first,
 * until one keeps it.
 */
function stripOnAnEdge(site: Site, footprint: Region, exclude: number | null): Piece | null {
  const edges = site.edges.filter((e) => e.index !== exclude && e.lengthM >= MIN_FRONT_EDGE_M).sort((a, b) => b.lengthM - a.lengthM);
  const candidates = edges
    .slice(0, MAX_OTHER_EDGES)
    .map((edge) => largestPiece(beyond(footprint, edge, FRONT_OPEN_SPACE_TALL_M) ?? []))
    .filter((whole) => hasOpenSpace(site, whole))
    .sort((a, b) => regionArea(b) - regionArea(a));
  for (const whole of candidates) {
    const p = plateOn(whole);
    if (hasOpenSpace(site, p.basePlate)) return p;
  }
  return null;
}

/** The deepest cut, at least two floor widths behind the front of `region`, that meets clause 53. */
function cutForClause53(site: Site, region: Region, governing: EdgeInfo): Piece | null {
  const line = inwardLine(governing);
  if (line === null) return null;
  const depths = region.flatMap((poly) => poly.outer.map((q) => line.n.x * q.x + line.n.y * q.y - line.k));
  if (depths.length === 0) return null;
  // Judged on the cut before the narrow parts are removed; the chosen cut is opened and judged again.
  const at = (d: number): Region => largestPiece(within(region, governing, d));
  let lo = Math.max(0, Math.min(...depths)) + MIN_DEPTH_WIDTHS * MIN_MAIN_WIDTH_M;
  let hi = Math.max(...depths);
  if (!meets53WithMargin(site, at(lo))) return null;
  for (let i = 0; i < DEPTH_MAX_STEPS && hi - lo > DEPTH_PRECISION_M; i++) {
    const mid = (lo + hi) / 2;
    if (meets53WithMargin(site, at(mid))) lo = mid;
    else hi = mid;
  }
  const p = plateOn(at(lo));
  return meets53WithMargin(site, p.basePlate) ? p : null;
}

/** The stricter reading on a public road: the 12 m strip on the governing road, as described above. */
function strictPlate(site: Site, footprint: Region, governing: EdgeInfo, plain: Piece): FrontPlate {
  const stripped = beyond(footprint, governing, FRONT_OPEN_SPACE_TALL_M);
  if (stripped === null) return withNarrow(plain, plain);
  const main = plateOn(stripped);
  // The strip itself is open space, not ground lost for being narrow, so the governing cut reports
  // only its own narrow parts; any other cut reports those of the whole footprint.
  if (hasOpenSpace(site, main.basePlate) || meets53WithMargin(site, main.basePlate)) return withNarrow(main, main);
  const chosen = stripOnAnEdge(site, footprint, governing.index) ?? cutForClause53(site, stripped, governing) ?? main;
  return withNarrow(chosen, chosen === main ? main : plain);
}

export function frontPlate(site: Site, regime: RegimeRules, footprint: Region, strict: boolean): FrontPlate {
  const plain = plateOn(footprint);
  const on = regime.rules.some((r) => r.id === FRONT_ACCESS_RULE && !r.disabled);
  const governing = on ? governingEdgeOf(site, regime.heightPlanes) : null;
  if (governing === null) return withNarrow(plain, plain);
  if (!onPublicRoad(site, regime)) return withNarrow(stripOnAnEdge(site, footprint, null) ?? plain, plain);
  if (strict) return strictPlate(site, footprint, governing, plain);
  if (meets53WithMargin(site, plain.basePlate)) return withNarrow(plain, plain);
  return withNarrow(cutForClause53(site, footprint, governing) ?? plain, plain);
}

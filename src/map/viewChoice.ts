/**
 * Chooses the camera bearing and pitch for framing the plot so that surrounding buildings
 * hide as little of it as possible. Pure: it reads building footprints and heights only.
 *
 * Local metres are x east, y north (core/geom/frame.ts). A map bearing is the compass direction
 * the camera looks; the camera stands on the opposite side of the plot. Pitch is MapLibre's:
 * degrees from looking straight down, so the sight line rises at (90 - pitch) degrees.
 */
import { makeFrame, metresPerDegree, toLocal } from '../core/geom/frame';
import { centroid, pointInRing } from '../core/geom/ring';
import type { EdgeSpec, LngLat, Pt, Ring } from '../core/types';
import type { BuildingFootprint } from './buildingsOnPlot';
import { FRAME_PITCH_DEGREES, roadSideBearing } from './framing';

/** Bearings are tried every this many degrees, starting from the preferred one. */
export const BEARING_STEP_DEGREES = 15;
/** Steeper views tried, in order, when every bearing at the default pitch is badly occluded. */
export const FALLBACK_PITCHES: readonly number[] = [45, 35];
/** Buildings further than this from the plot are ignored. */
export const OCCLUDER_RANGE_M = 300;
/** Sample heights: the ground, and a representative height for a mid-rise design. */
export const SAMPLE_HEIGHTS_M: readonly number[] = [0, 20];
/** Within this share of the best score, the bearing closest to the preferred one wins. */
export const SCORE_TOLERANCE = 0.06;
/** A view hiding more than this share of the samples counts as badly occluded. */
export const BAD_OCCLUSION = 0.34;
/**
 * Each bearing is scored as the mean over itself and these offsets, so a bearing that only just
 * slips past a tower (with the tower still filling the edge of the view) scores worse than one
 * with clear room on both sides.
 */
const SMOOTHING_OFFSETS_DEGREES: readonly number[] = [-6, 0, 6];
/** Corner samples are pulled this far towards the centroid, off the shared boundary. */
const SAMPLE_INSET_M = 2;
const DEG = Math.PI / 180;

export interface ViewChoice {
  readonly bearing: number;
  readonly pitch: number;
  /** Share of the samples hidden, 0 to 1. */
  readonly occlusion: number;
}

export interface ViewChoiceInput {
  readonly plot: readonly LngLat[];
  readonly edges: readonly EdgeSpec[];
  readonly buildings: readonly BuildingFootprint[];
  /** Buildings already hidden because they stand on the plot. They block nothing. */
  readonly hiddenIds: ReadonlySet<number>;
  /** Used as the preferred bearing when no edge is a road. */
  readonly currentBearing: number;
}

/** A building near the plot, in local metres, with a bounding circle for fast rejection. */
interface Occluder {
  readonly rings: readonly Ring[];
  readonly height: number;
  readonly centre: Pt;
  readonly radius: number;
}

interface Sample {
  readonly point: Pt;
  readonly z: number;
}

function normalizeBearing(degrees: number): number {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped + 0;
}

function angularDistance(a: number, b: number): number {
  return Math.abs(normalizeBearing(a - b));
}

function nearbyOccluders(input: ViewChoiceInput, frame: ReturnType<typeof makeFrame>): Occluder[] {
  const lngs = input.plot.map((point) => point[0]);
  const lats = input.plot.map((point) => point[1]);
  const scale = metresPerDegree(frame.origin[1]);
  const padLng = OCCLUDER_RANGE_M / scale.lng;
  const padLat = OCCLUDER_RANGE_M / scale.lat;
  const minLng = Math.min(...lngs) - padLng;
  const maxLng = Math.max(...lngs) + padLng;
  const minLat = Math.min(...lats) - padLat;
  const maxLat = Math.max(...lats) + padLat;

  return input.buildings.flatMap((building): Occluder[] => {
    if (building.height <= 0 || input.hiddenIds.has(building.id)) return [];
    if (building.maxLng < minLng || building.minLng > maxLng || building.maxLat < minLat || building.minLat > maxLat) {
      return [];
    }
    const rings = building.polygons.map((polygon) => polygon.outer.map((point) => toLocal(frame, point)));
    const points = rings.flat();
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    const radius = Math.max(...points.map((p) => Math.hypot(p.x - centre.x, p.y - centre.y)));
    return [{ rings, height: building.height, centre, radius }];
  });
}

function towardCentroid(point: Pt, middle: Pt): Pt {
  const dx = middle.x - point.x;
  const dy = middle.y - point.y;
  const length = Math.hypot(dx, dy);
  const step = length > 0 ? Math.min(SAMPLE_INSET_M, length / 2) / length : 0;
  return { x: point.x + dx * step, y: point.y + dy * step };
}

/** Corners, edge midpoints and the centroid, at each sample height. */
function samplesOf(plotLocal: readonly Pt[]): Sample[] {
  const middle = centroid(plotLocal);
  const boundary = plotLocal.flatMap((corner, index) => {
    const next = plotLocal[(index + 1) % plotLocal.length] ?? corner;
    return [corner, { x: (corner.x + next.x) / 2, y: (corner.y + next.y) / 2 }];
  });
  const points = [...boundary.map((point) => towardCentroid(point, middle)), middle];
  return SAMPLE_HEIGHTS_M.flatMap((z) => points.map((point) => ({ point, z })));
}

/** Distance along the ray (origin p, unit direction u) at which it first meets segment ab. */
function raySegmentDistance(p: Pt, u: Pt, a: Pt, b: Pt): number {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const denominator = u.x * ey - u.y * ex;
  if (Math.abs(denominator) < 1e-12) return Infinity;
  const ax = a.x - p.x;
  const ay = a.y - p.y;
  const t = (ax * ey - ay * ex) / denominator;
  const s = (ax * u.y - ay * u.x) / denominator;
  return t >= 0 && s >= 0 && s <= 1 ? t : Infinity;
}

/** Where the ray first enters the footprint: 0 when it starts inside, Infinity when it misses. */
function entryDistance(p: Pt, u: Pt, rings: readonly Ring[]): number {
  let best = Infinity;
  for (const ring of rings) {
    if (pointInRing(p, ring)) return 0;
    for (let index = 0; index < ring.length; index += 1) {
      const a = ring[index];
      const b = ring[(index + 1) % ring.length];
      if (a && b) best = Math.min(best, raySegmentDistance(p, u, a, b));
    }
  }
  return best;
}

/**
 * Whether the sight line from the sample towards the camera passes below the top of a building:
 * it rises by d * tan(elevation) over a horizontal distance d, and since it only rises, the
 * point where the ray first enters a footprint is where it is lowest over that building.
 */
function isHidden(sample: Sample, towardCamera: Pt, rise: number, occluders: readonly Occluder[]): boolean {
  const { point, z } = sample;
  return occluders.some((occluder) => {
    if (occluder.height <= z) return false;
    const reach = (occluder.height - z) / rise;
    const cx = occluder.centre.x - point.x;
    const cy = occluder.centre.y - point.y;
    const along = cx * towardCamera.x + cy * towardCamera.y;
    const across = Math.abs(cx * towardCamera.y - cy * towardCamera.x);
    if (across > occluder.radius || along < -occluder.radius || along - occluder.radius > reach) return false;
    return entryDistance(point, towardCamera, occluder.rings) < reach;
  });
}

function occlusionAt(bearing: number, pitch: number, samples: readonly Sample[], occluders: readonly Occluder[]): number {
  if (samples.length === 0) return 0;
  const towardCamera = { x: -Math.sin(bearing * DEG), y: -Math.cos(bearing * DEG) };
  const rise = Math.tan((90 - pitch) * DEG);
  const hidden = samples.filter((sample) => isHidden(sample, towardCamera, rise, occluders)).length;
  return hidden / samples.length;
}

/** The least occluded bearing at one pitch, preferring bearings close to `preferred`. */
function bestBearing(
  pitch: number,
  preferred: number,
  samples: readonly Sample[],
  occluders: readonly Occluder[],
): ViewChoice {
  const steps = Math.round(360 / BEARING_STEP_DEGREES);
  const scored = Array.from({ length: steps }, (_, step) => {
    const bearing = normalizeBearing(preferred + step * BEARING_STEP_DEGREES);
    const scores = SMOOTHING_OFFSETS_DEGREES.map((offset) => occlusionAt(bearing + offset, pitch, samples, occluders));
    const occlusion = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return { bearing, pitch, occlusion };
  });
  const lowest = Math.min(...scored.map((view) => view.occlusion));
  const acceptable = scored.filter((view) => view.occlusion <= lowest + SCORE_TOLERANCE);
  return acceptable.reduce((best, view) =>
    angularDistance(view.bearing, preferred) < angularDistance(best.bearing, preferred) ? view : best,
  );
}

/**
 * The bearing (every 15 degrees from the road-side bearing, or from the current bearing when
 * there is no road) and pitch (58, then 45 and 35 if every bearing is badly occluded) from which
 * the fewest plot samples are hidden behind surrounding buildings. Samples are the corners, edge
 * midpoints and the centroid, at ground level and at 20 m.
 */
export function chooseView(input: ViewChoiceInput): ViewChoice {
  const preferred = roadSideBearing(input.plot, input.edges) ?? normalizeBearing(input.currentBearing);
  if (input.plot.length < 3) return { bearing: preferred, pitch: FRAME_PITCH_DEGREES, occlusion: 0 };

  const frame = makeFrame(input.plot);
  const plotLocal = input.plot.map((point) => toLocal(frame, point));
  const samples = samplesOf(plotLocal);
  const occluders = nearbyOccluders(input, frame);

  let best = bestBearing(FRAME_PITCH_DEGREES, preferred, samples, occluders);
  for (const pitch of FALLBACK_PITCHES) {
    if (best.occlusion <= BAD_OCCLUSION) break;
    const steeper = bestBearing(pitch, preferred, samples, occluders);
    if (steeper.occlusion < best.occlusion) best = steeper;
  }
  return best;
}

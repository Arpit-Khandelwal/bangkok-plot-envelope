import type { Feature, FeatureCollection, LineString } from 'geojson';
import type { LngLat } from '../core/types';
import { MAX_ROAD_WIDTH_M, MIN_ROAD_WIDTH_M } from '../state/defaults';
import { makeProjection, projectPos } from './geo';
import type { Pos } from './geo';

export interface RoadProperties {
  readonly name?: string;
  readonly nameTh?: string;
  readonly class?: string;
  readonly lanes?: number;
  /** Estimated full road width in metres. */
  readonly widthEst?: number;
  readonly widthSrc?: 'tag' | 'est';
}

export type RoadCollection = FeatureCollection<LineString, RoadProperties>;

export interface RoadWidthSuggestion {
  readonly widthM: number;
  readonly roadName: string | null;
  readonly source: 'tag' | 'est';
  /** Distance from the edge midpoint to the road centreline, in metres. */
  readonly distanceM: number;
}

/** How far from the edge midpoint a centreline is ever searched for. */
export const MAX_ROAD_DISTANCE_M = 40;
/**
 * A centreline counts as a road the edge abuts only within half its estimated width plus this much
 * (a verge, a footpath, a drawing error), so a main road behind a side street never wins.
 */
export const ABUT_SLACK_M = 8;
/** Candidates within this distance of the nearest are a near tie, settled by running along the edge. */
export const NEAR_TIE_M = 3;
/** A road within this angle of the edge direction counts as running along it. */
export const MAX_PARALLEL_ANGLE_DEG = 30;

const COS_PARALLEL = Math.cos((MAX_PARALLEL_ANGLE_DEG * Math.PI) / 180);
const DECIMAL_STEP = 10;

interface Candidate {
  readonly feature: Feature<LineString, RoadProperties>;
  readonly widthM: number;
  readonly distanceM: number;
  readonly isParallel: boolean;
}

function closestOnSegment(a: Pos, b: Pos): { readonly point: Pos; readonly distance: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / lenSq));
  const point: Pos = [a[0] + t * dx, a[1] + t * dy];
  return { point, distance: Math.hypot(point[0], point[1]) };
}

/** Centroid of the plot corners in local metres. Good enough to say which side of an edge is "out". */
function centroidOf(points: readonly Pos[]): Pos {
  const sum = points.reduce<[number, number]>((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

function usableWidth(properties: RoadProperties | null | undefined): number | null {
  const width = properties?.widthEst;
  if (typeof width !== 'number' || !Number.isFinite(width)) return null;
  return width >= MIN_ROAD_WIDTH_M && width <= MAX_ROAD_WIDTH_M ? width : null;
}

/** The nearest candidate; among those within `NEAR_TIE_M` of it, the nearest running along the edge. */
function choose(candidates: readonly Candidate[]): Candidate | null {
  const nearest = candidates.reduce<Candidate | null>((best, c) => (best === null || c.distanceM < best.distanceM ? c : best), null);
  if (nearest === null) return null;
  const tied = candidates.filter((c) => c.isParallel && c.distanceM <= nearest.distanceM + NEAR_TIE_M);
  return tied.reduce<Candidate>((best, c) => (c.distanceM < best.distanceM || !best.isParallel ? c : best), nearest);
}

/**
 * The road centreline an edge most plausibly abuts, with its estimated width. Only centreline
 * segments on the side of the edge away from the plot, no further from the edge midpoint than half
 * the road's estimated width plus 8 m, count. The nearest wins; running along the edge only settles
 * a near tie (within 3 m). Returns null rather than a road the plot does not reach.
 */
export function suggestRoadWidth(
  plot: readonly LngLat[],
  edgeIndex: number,
  roads: RoadCollection,
): RoadWidthSuggestion | null {
  const start = plot[edgeIndex];
  const end = plot[(edgeIndex + 1) % plot.length];
  if (!start || !end || plot.length < 3) return null;

  const mid: Pos = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const projection = makeProjection(mid);
  const scale = projection.scale;
  const local = (point: LngLat): Pos => projectPos(projection, point);

  const a = local(start);
  const b = local(end);
  const edgeLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (edgeLength === 0) return null;
  const direction: Pos = [(b[0] - a[0]) / edgeLength, (b[1] - a[1]) / edgeLength];
  const centroid = centroidOf(plot.map(local));
  // Outward normal: the perpendicular that points away from the centroid (the midpoint is the origin).
  const normalSign = direction[1] * centroid[0] - direction[0] * centroid[1] > 0 ? 1 : -1;
  const normal: Pos = [-direction[1] * normalSign, direction[0] * normalSign];

  // Search box in degrees, so most of the ~3,400 centrelines are rejected without projecting.
  const dLng = MAX_ROAD_DISTANCE_M / scale.mPerDegLng;
  const dLat = MAX_ROAD_DISTANCE_M / scale.mPerDegLat;
  const candidates: Candidate[] = [];
  for (const feature of roads.features) {
    const coordinates = feature.geometry?.coordinates;
    const width = usableWidth(feature.properties);
    if (!coordinates || width === null) continue;
    const reach = Math.min(MAX_ROAD_DISTANCE_M, width / 2 + ABUT_SLACK_M);
    for (let index = 0; index + 1 < coordinates.length; index += 1) {
      const p = coordinates[index];
      const q = coordinates[index + 1];
      if (!p || !q) continue;
      // Skip unless the segment's own box touches the search box.
      const overlaps =
        Math.min(p[0] ?? 0, q[0] ?? 0) <= mid[0] + dLng &&
        Math.max(p[0] ?? 0, q[0] ?? 0) >= mid[0] - dLng &&
        Math.min(p[1] ?? 0, q[1] ?? 0) <= mid[1] + dLat &&
        Math.max(p[1] ?? 0, q[1] ?? 0) >= mid[1] - dLat;
      if (!overlaps) continue;

      const pa = local([p[0] ?? 0, p[1] ?? 0]);
      const pb = local([q[0] ?? 0, q[1] ?? 0]);
      const { point, distance } = closestOnSegment(pa, pb);
      if (distance > reach || point[0] * normal[0] + point[1] * normal[1] <= 0) continue;

      const length = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      const cosine = length === 0 ? 0 : Math.abs(((pb[0] - pa[0]) * direction[0] + (pb[1] - pa[1]) * direction[1]) / length);
      candidates.push({ feature, widthM: width, distanceM: distance, isParallel: cosine >= COS_PARALLEL });
    }
  }

  const best = choose(candidates);
  if (!best) return null;
  const properties = best.feature.properties;
  const widthM = best.widthM;
  return {
    widthM: Math.round(widthM * DECIMAL_STEP) / DECIMAL_STEP,
    roadName: properties.name ?? properties.nameTh ?? null,
    source: properties.widthSrc === 'tag' ? 'tag' : 'est',
    distanceM: Math.round(best.distanceM * DECIMAL_STEP) / DECIMAL_STEP,
  };
}

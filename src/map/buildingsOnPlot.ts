/**
 * Which existing buildings to hide because they stand on the plot. Pure, so it is tested
 * without a map. A developer assessing a plot assumes it will be cleared, and an old building
 * left standing would swallow the proposal.
 */
import type { Feature, Geometry, Position } from 'geojson';
import { makeFrame, toLocal } from '../core/geom/frame';
import { intersection, pointInPolygon, polygonArea, regionArea } from '../core/geom/region';
import { centroid, pointInRing, signedArea } from '../core/geom/ring';
import type { LngLat, LocalFrame, Polygon, Pt, Region, Ring } from '../core/types';

/** A building is hidden when more than this share of its own footprint lies on the plot. */
export const MIN_OVERLAP_SHARE = 0.2;

interface FootprintPolygon {
  readonly outer: readonly LngLat[];
  readonly holes: readonly (readonly LngLat[])[];
}

export interface BuildingFootprint {
  /** The building's `i` property. */
  readonly id: number;
  /** Height in metres (the `h` property), 0 when unknown. */
  readonly height: number;
  readonly polygons: readonly FootprintPolygon[];
  readonly minLng: number;
  readonly minLat: number;
  readonly maxLng: number;
  readonly maxLat: number;
}

/** GeoJSON rings repeat their first position at the end; ours do not. */
function openRing(ring: readonly Position[]): LngLat[] {
  const points = ring.map((position): LngLat => [position[0] ?? 0, position[1] ?? 0]);
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) points.pop();
  return points;
}

function polygonsOf(geometry: Geometry): Position[][][] {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

/** The properties the footprint index reads. */
export interface FootprintProperties {
  readonly i: number;
  readonly h?: number;
}

function toFootprint(feature: Feature<Geometry, FootprintProperties>): BuildingFootprint | null {
  const polygons = polygonsOf(feature.geometry)
    .map(([outer, ...holes]): FootprintPolygon => ({ outer: openRing(outer ?? []), holes: holes.map(openRing) }))
    .filter((polygon) => polygon.outer.length >= 3);
  if (polygons.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  polygons.forEach((polygon) =>
    polygon.outer.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }),
  );
  const height = feature.properties.h;
  return {
    id: feature.properties.i,
    height: typeof height === 'number' && Number.isFinite(height) ? height : 0,
    polygons,
    minLng,
    minLat,
    maxLng,
    maxLat,
  };
}

/** Precomputes bounding boxes once per dataset, so each plot edit only scans numbers. */
export function indexFootprints(features: readonly Feature<Geometry, FootprintProperties>[]): BuildingFootprint[] {
  return features.flatMap((feature) => {
    const footprint = toFootprint(feature);
    return footprint ? [footprint] : [];
  });
}

/** Local ring with the given orientation (outer rings CCW, holes CW, as clipper expects). */
function localRing(frame: LocalFrame, ring: readonly LngLat[], counterClockwise: boolean): Ring {
  const local = ring.map((point) => toLocal(frame, point));
  return signedArea(local) > 0 === counterClockwise ? local : [...local].reverse();
}

function localRegion(frame: LocalFrame, footprint: BuildingFootprint): Polygon[] {
  return footprint.polygons.map((polygon) => ({
    outer: localRing(frame, polygon.outer, true),
    holes: polygon.holes.map((hole) => localRing(frame, hole, false)),
  }));
}

/** Area-weighted centre of the building's outer rings. */
function footprintCentre(region: readonly Polygon[]): Pt {
  let weight = 0;
  let x = 0;
  let y = 0;
  region.forEach((polygon) => {
    const area = Math.abs(signedArea(polygon.outer));
    const centre = centroid(polygon.outer);
    weight += area;
    x += centre.x * area;
    y += centre.y * area;
  });
  if (weight > 0) return { x: x / weight, y: y / weight };
  return centroid(region[0]?.outer ?? []);
}

/**
 * Ids of the buildings to hide: those whose centre is on the plot (and that touch it), that contain the plot's
 * centroid, or that have more than `minOverlapShare` of their own footprint on the plot.
 * Buildings whose bounding box misses the plot's are skipped before any projection.
 */
export function buildingsOnPlot(
  footprints: readonly BuildingFootprint[],
  plot: readonly LngLat[],
  minOverlapShare: number = MIN_OVERLAP_SHARE,
): number[] {
  if (plot.length < 3) return [];
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  plot.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  });

  const frame = makeFrame(plot);
  const plotRing = localRing(frame, plot, true);
  const plotRegion: Region = [{ outer: plotRing, holes: [] }];
  const plotCentroid = centroid(plotRing);

  const hidden: number[] = [];
  for (const footprint of footprints) {
    const missesBox =
      footprint.maxLng < minLng || footprint.minLng > maxLng || footprint.maxLat < minLat || footprint.minLat > maxLat;
    if (missesBox) continue;
    const region = localRegion(frame, footprint);
    if (region.some((polygon) => pointInPolygon(plotCentroid, polygon))) {
      hidden.push(footprint.id);
      continue;
    }
    const ownArea = region.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
    if (!(ownArea > 0)) continue;
    const overlap = regionArea(intersection(region, plotRegion));
    // The centre of an L-shaped or courtyard building can fall on the plot while the building
    // itself does not touch it, so the centre test also needs some actual overlap.
    const centreOnPlot = overlap > 0 && pointInRing(footprintCentre(region), plotRing);
    if (centreOnPlot || overlap > minOverlapShare * ownArea) hidden.push(footprint.id);
  }
  return hidden;
}

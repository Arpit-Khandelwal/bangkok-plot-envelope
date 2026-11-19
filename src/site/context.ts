import { intersection, regionArea, union } from "../core/geom";
import type { LngLat, Polygon, Pt, Region, ZoneRef } from "../core/types";
import type { SiteData } from "./siteData";
import {
  boundsIntersect,
  boundsOf,
  boundsOfGeometry,
  expandBounds,
  isEmptyGeometry,
  makeProjection,
  metreScaleAt,
  parseGeometry,
  pointInPolygon,
  pointInRing,
  pointSegmentDistance,
  ringEdges,
  segmentSegmentDistance,
  projectPos,
  type Bounds,
  type FlatProjection,
  type ParsedGeometry,
  type Pos,
  type PosRing,
} from "./geo";

export type ZoneLookup =
  /** The plot lies in one zone, to within 1 m² or 0.1% of its area. */
  | { readonly status: "single"; readonly zone: ZoneRef }
  /** The plot crosses a zone boundary. `zones` lists each zone holding more than the tolerance of it. */
  | { readonly status: "straddles"; readonly zones: readonly ZoneRef[] }
  /** No mapped zone holds more of the plot than that tolerance. */
  | { readonly status: "outside" };

export interface NearestStation {
  readonly name: string;
  readonly ref: string | null;
  /** Shortest distance from the plot outline to the station platform geometry, in metres. */
  readonly distanceM: number;
  /** `node` means only a station point was available, so the distance is less precise. */
  readonly geomSource: "platform" | "node";
}

const MIN_PLOT_POINTS = 3;
/** Stations farther than this from the plot's bounding box are skipped unless nothing is nearer. */
const STATION_SEARCH_RADIUS_M = 3000;
const AREA_EPSILON = 1e-18;

// ---------- Plot preparation ----------

/** Finite points only, without a repeated closing point. Fewer than 3 points gives an empty ring. */
function cleanPlot(plot: readonly LngLat[]): PosRing {
  const points: Pos[] = [];
  for (const point of plot) {
    const lng = point?.[0];
    const lat = point?.[1];
    if (
      typeof lng === "number" &&
      typeof lat === "number" &&
      Number.isFinite(lng) &&
      Number.isFinite(lat)
    ) {
      points.push([lng, lat]);
    }
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (
    points.length > 1 &&
    first &&
    last &&
    first[0] === last[0] &&
    first[1] === last[1]
  )
    points.pop();
  return points.length >= MIN_PLOT_POINTS ? points : [];
}

function averagePoint(ring: PosRing): Pos {
  const sum = ring.reduce<Pos>(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
    [0, 0],
  );
  return [sum[0] / ring.length, sum[1] / ring.length];
}

/** Area centroid, falling back to the vertex average for degenerate rings. */
function centroidOf(ring: PosRing): Pos {
  const origin = averagePoint(ring);
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (const [a, b] of ringEdges(ring, true)) {
    const ax = a[0] - origin[0];
    const ay = a[1] - origin[1];
    const bx = b[0] - origin[0];
    const by = b[1] - origin[1];
    const w = ax * by - bx * ay;
    area2 += w;
    cx += (ax + bx) * w;
    cy += (ay + by) * w;
  }
  if (Math.abs(area2) < AREA_EPSILON) return origin;
  return [origin[0] + cx / (3 * area2), origin[1] + cy / (3 * area2)];
}

// ---------- Zones ----------

interface ParsedZone {
  readonly ref: ZoneRef;
  readonly geometry: ParsedGeometry;
  readonly bounds: Bounds;
}

const zoneCache = new WeakMap<object, ParsedZone | null>();

function parseZone(
  feature: SiteData["zones"]["features"][number],
): ParsedZone | null {
  const cached = zoneCache.get(feature);
  if (cached !== undefined) return cached;
  const props = (feature.properties ?? {}) as Partial<
    Record<"zone" | "planVersion", unknown>
  >;
  const geometry = parseGeometry(feature.geometry);
  const bounds = boundsOfGeometry(geometry);
  const parsed: ParsedZone | null =
    typeof props.zone === "string" &&
    props.zone !== "" &&
    bounds &&
    geometry.polygons.length > 0
      ? {
          ref: {
            code: props.zone,
            planVersion:
              typeof props.planVersion === "string" ? props.planVersion : "",
          },
          geometry,
          bounds,
        }
      : null;
  zoneCache.set(feature, parsed);
  return parsed;
}

function zoneKey(ref: ZoneRef): string {
  return `${ref.code}\u0000${ref.planVersion}`;
}

/**
 * A plot is in a zone when no more of it than this lies outside the zone's polygons, and touches a
 * zone when more than this lies inside: 1 m², or 0.1% of the plot when that is larger.
 */
const ZONE_TOLERANCE_M2 = 1;
const ZONE_TOLERANCE_SHARE = 0.001;

function toRegionRing(projection: FlatProjection, ring: PosRing): Pt[] {
  return ring.map((p) => {
    const [x, y] = projectPos(projection, p);
    return { x, y };
  });
}

/** The zone's polygons, holes kept, in the plot's flat metres. */
function zoneRegion(zone: ParsedZone, projection: FlatProjection): Region {
  return union(
    zone.geometry.polygons.flatMap((polygon): Polygon[] => {
      const [outer, ...holes] = polygon;
      return outer === undefined ? [] : [{ outer: toRegionRing(projection, outer), holes: holes.map((h) => toRegionRing(projection, h)) }];
    }),
  );
}

/**
 * Which plan zone the plot is in, by area: `single` when one zone's polygons (holes respected) hold
 * all of the plot but at most the tolerance, `straddles` listing every zone that holds more than the
 * tolerance otherwise, and `outside` when none does. Zones are first filtered by bounding box.
 */
export function locateZone(
  plot: readonly LngLat[],
  zones: SiteData["zones"],
): ZoneLookup {
  const ring = cleanPlot(plot);
  const features = zones?.features;
  if (ring.length === 0 || !Array.isArray(features))
    return { status: "outside" };
  const plotBounds = boundsOf(ring);
  if (!plotBounds) return { status: "outside" };

  const projection = makeProjection(centroidOf(ring));
  const plotRegion = union([{ outer: toRegionRing(projection, ring), holes: [] }]);
  const plotArea = regionArea(plotRegion);
  if (!(plotArea > 0)) return { status: "outside" };
  const tolerance = Math.max(ZONE_TOLERANCE_M2, ZONE_TOLERANCE_SHARE * plotArea);

  const inside = new Map<string, { readonly ref: ZoneRef; readonly areaM2: number }>();
  for (const feature of features) {
    const zone = feature ? parseZone(feature) : null;
    if (!zone || !boundsIntersect(zone.bounds, plotBounds)) continue;
    const areaM2 = regionArea(intersection(plotRegion, zoneRegion(zone, projection)));
    const key = zoneKey(zone.ref);
    inside.set(key, { ref: zone.ref, areaM2: (inside.get(key)?.areaM2 ?? 0) + areaM2 });
  }

  const touched = [...inside.values()].filter((z) => z.areaM2 > tolerance);
  const only = touched[0];
  if (!only) return { status: "outside" };
  if (touched.length === 1 && plotArea - only.areaM2 <= tolerance) return { status: "single", zone: only.ref };
  return { status: "straddles", zones: touched.map((z) => z.ref) };
}

// ---------- Stations ----------

interface ParsedStation {
  readonly name: string;
  readonly ref: string | null;
  readonly geomSource: "platform" | "node";
  readonly geometry: ParsedGeometry;
  readonly bounds: Bounds;
}

const stationCache = new WeakMap<object, ParsedStation | null>();

function parseStation(
  feature: SiteData["stations"]["features"][number],
): ParsedStation | null {
  const cached = stationCache.get(feature);
  if (cached !== undefined) return cached;
  const props = (feature.properties ?? {}) as Partial<
    Record<"name" | "nameTh" | "ref" | "geomSource", unknown>
  >;
  const geometry = parseGeometry(feature.geometry);
  const bounds = isEmptyGeometry(geometry) ? null : boundsOfGeometry(geometry);
  let parsed: ParsedStation | null = null;
  if (bounds) {
    const pointOnly =
      geometry.lines.length === 0 && geometry.polygons.length === 0;
    const name =
      typeof props.name === "string" && props.name !== ""
        ? props.name
        : props.nameTh;
    parsed = {
      name: typeof name === "string" ? name : "",
      ref: typeof props.ref === "string" && props.ref !== "" ? props.ref : null,
      geomSource:
        props.geomSource === "platform" || props.geomSource === "node"
          ? props.geomSource
          : pointOnly
            ? "node"
            : "platform",
      geometry,
      bounds,
    };
  }
  stationCache.set(feature, parsed);
  return parsed;
}

function projectRing(projection: FlatProjection, ring: PosRing): PosRing {
  return ring.map((p) => projectPos(projection, p));
}

/** Shortest distance in metres between the plot (outline and interior) and a station's geometry. Inputs are flat metres. */
function distanceToPlot(
  plot: PosRing,
  plotEdges: ReturnType<typeof ringEdges>,
  g: ParsedGeometry,
  proj: FlatProjection,
): number {
  let best = Number.POSITIVE_INFINITY;

  for (const lngLat of g.points) {
    const p = projectPos(proj, lngLat);
    if (pointInRing(p, plot)) return 0;
    for (const [a, b] of plotEdges)
      best = Math.min(best, pointSegmentDistance(p, a, b));
  }

  const outlines: PosRing[] = [
    ...g.lines.map((line) => projectRing(proj, line)),
    ...g.polygons.flatMap((polygon) =>
      polygon.map((ring) => projectRing(proj, ring)),
    ),
  ];
  const closedFrom = g.lines.length;
  for (const [index, outline] of outlines.entries()) {
    const first = outline[0];
    if (first && pointInRing(first, plot)) return 0;
    for (const [c, d] of ringEdges(outline, index >= closedFrom)) {
      for (const [a, b] of plotEdges) {
        best = Math.min(best, segmentSegmentDistance(a, b, c, d));
        if (best === 0) return 0;
      }
    }
  }

  // The plot may sit wholly inside a platform polygon.
  const plotFirst = plot[0];
  if (plotFirst) {
    const inside = g.polygons.some((polygon) =>
      pointInPolygon(
        plotFirst,
        polygon.map((ring) => projectRing(proj, ring)),
      ),
    );
    if (inside) return 0;
  }
  return best;
}

/** The closest mass-transit station to the plot. */
export function nearestStation(
  plot: readonly LngLat[],
  stations: SiteData["stations"],
): NearestStation | null {
  const ring = cleanPlot(plot);
  const features = stations?.features;
  const plotBounds = boundsOf(ring);
  if (ring.length === 0 || !plotBounds || !Array.isArray(features)) return null;

  const parsed = features.flatMap((feature) => {
    const station = feature ? parseStation(feature) : null;
    return station ? [station] : [];
  });

  const centre = averagePoint(ring);
  const scale = metreScaleAt(centre[1]);
  const search = expandBounds(
    plotBounds,
    STATION_SEARCH_RADIUS_M / scale.mPerDegLng,
    STATION_SEARCH_RADIUS_M / scale.mPerDegLat,
  );
  const near = parsed.filter((station) =>
    boundsIntersect(station.bounds, search),
  );
  const candidates = near.length > 0 ? near : parsed;

  const projection = makeProjection(centre);
  const flatPlot = projectRing(projection, ring);
  const plotEdges = ringEdges(flatPlot, true);

  let best: NearestStation | null = null;
  for (const station of candidates) {
    const distanceM = distanceToPlot(
      flatPlot,
      plotEdges,
      station.geometry,
      projection,
    );
    if (best === null || distanceM < best.distanceM) {
      best = {
        name: station.name,
        ref: station.ref,
        distanceM,
        geomSource: station.geomSource,
      };
    }
  }
  return best;
}

/**
 * Small, pure geometry helpers for site context lookups.
 * Tolerant by design: anything that is not valid GeoJSON geometry is ignored, never thrown on.
 */

export type Pos = readonly [x: number, y: number];
/** Open or closed ring of positions. */
export type PosRing = readonly Pos[];
/** Outer ring first, then holes. */
export type PosPolygon = readonly PosRing[];

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface ParsedGeometry {
  readonly points: readonly Pos[];
  readonly lines: readonly PosRing[];
  readonly polygons: readonly PosPolygon[];
}

export const EMPTY_GEOMETRY: ParsedGeometry = {
  points: [],
  lines: [],
  polygons: [],
};

const WGS84_LAT_M = [111132.92, -559.82, 1.175, -0.0023] as const;
const WGS84_LNG_M = [111412.84, -93.5, 0.118] as const;
const DEG_TO_RAD = Math.PI / 180;
const MAX_GEOMETRY_DEPTH = 4;
const MIN_POLYGON_RING_POINTS = 3;

// ---------- Parsing ----------

function isPos(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function parseLine(value: unknown): PosRing {
  if (!Array.isArray(value)) return [];
  const out: Pos[] = [];
  for (const item of value as unknown[]) {
    if (isPos(item)) out.push([item[0] as number, item[1] as number]);
  }
  return out;
}

function parsePolygon(value: unknown): PosPolygon | null {
  if (!Array.isArray(value)) return null;
  const rings = (value as unknown[])
    .map(parseLine)
    .filter((ring) => ring.length >= MIN_POLYGON_RING_POINTS);
  return rings.length > 0 ? rings : null;
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

function merge(a: ParsedGeometry, b: ParsedGeometry): ParsedGeometry {
  return {
    points: [...a.points, ...b.points],
    lines: [...a.lines, ...b.lines],
    polygons: [...a.polygons, ...b.polygons],
  };
}

/** Flattens any GeoJSON geometry into points, lines and polygons. Unknown or malformed input gives nothing. */
export function parseGeometry(geometry: unknown, depth = 0): ParsedGeometry {
  if (
    typeof geometry !== "object" ||
    geometry === null ||
    depth > MAX_GEOMETRY_DEPTH
  )
    return EMPTY_GEOMETRY;
  const { type, coordinates, geometries } = geometry as {
    type?: unknown;
    coordinates?: unknown;
    geometries?: unknown;
  };
  switch (type) {
    case "Point":
      return isPos(coordinates)
        ? {
            points: [[coordinates[0] as number, coordinates[1] as number]],
            lines: [],
            polygons: [],
          }
        : EMPTY_GEOMETRY;
    case "MultiPoint":
      return { points: parseLine(coordinates), lines: [], polygons: [] };
    case "LineString": {
      const line = parseLine(coordinates);
      return line.length >= 2
        ? { points: [], lines: [line], polygons: [] }
        : EMPTY_GEOMETRY;
    }
    case "MultiLineString": {
      const lines = asArray(coordinates)
        .map(parseLine)
        .filter((line) => line.length >= 2);
      return { points: [], lines, polygons: [] };
    }
    case "Polygon": {
      const polygon = parsePolygon(coordinates);
      return polygon
        ? { points: [], lines: [], polygons: [polygon] }
        : EMPTY_GEOMETRY;
    }
    case "MultiPolygon": {
      const polygons = asArray(coordinates)
        .map(parsePolygon)
        .filter((polygon): polygon is PosPolygon => polygon !== null);
      return { points: [], lines: [], polygons };
    }
    case "GeometryCollection":
      return asArray(geometries).reduce<ParsedGeometry>(
        (acc, child) => merge(acc, parseGeometry(child, depth + 1)),
        EMPTY_GEOMETRY,
      );
    default:
      return EMPTY_GEOMETRY;
  }
}

export function isEmptyGeometry(g: ParsedGeometry): boolean {
  return (
    g.points.length === 0 && g.lines.length === 0 && g.polygons.length === 0
  );
}

// ---------- Bounds ----------

export function boundsOf(positions: readonly Pos[]): Bounds | null {
  const first = positions[0];
  if (!first) return null;
  let minX = first[0];
  let maxX = first[0];
  let minY = first[1];
  let maxY = first[1];
  for (const [x, y] of positions) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function boundsOfGeometry(g: ParsedGeometry): Bounds | null {
  return boundsOf([...g.points, ...g.lines.flat(), ...g.polygons.flat(2)]);
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
  );
}

export function expandBounds(b: Bounds, dx: number, dy: number): Bounds {
  return {
    minX: b.minX - dx,
    minY: b.minY - dy,
    maxX: b.maxX + dx,
    maxY: b.maxY + dy,
  };
}

export function boundsContain(b: Bounds, [x, y]: Pos): boolean {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

// ---------- Containment ----------

/** Even-odd ray casting against one ring. Works for open or closed rings. */
export function pointInRing(point: Pos, ring: PosRing): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    if (
      a[1] > py !== b[1] > py &&
      px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

/** Inside the outer ring and outside every hole. */
export function pointInPolygon(point: Pos, polygon: PosPolygon): boolean {
  const [outer, ...holes] = polygon;
  if (!outer || !pointInRing(point, outer)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

// ---------- Projection ----------

export interface MetreScale {
  readonly mPerDegLng: number;
  readonly mPerDegLat: number;
}

/** Metres per degree of longitude and latitude on the WGS84 ellipsoid at a latitude. */
export function metreScaleAt(latDeg: number): MetreScale {
  const phi = latDeg * DEG_TO_RAD;
  const [l0, l1, l2, l3] = WGS84_LAT_M;
  const [g0, g1, g2] = WGS84_LNG_M;
  return {
    mPerDegLat:
      l0 +
      l1 * Math.cos(2 * phi) +
      l2 * Math.cos(4 * phi) +
      l3 * Math.cos(6 * phi),
    mPerDegLng:
      g0 * Math.cos(phi) + g1 * Math.cos(3 * phi) + g2 * Math.cos(5 * phi),
  };
}

export interface FlatProjection {
  readonly origin: Pos;
  readonly scale: MetreScale;
}

export function makeProjection(origin: Pos): FlatProjection {
  return { origin, scale: metreScaleAt(origin[1]) };
}

export function projectPos(p: FlatProjection, [lng, lat]: Pos): Pos {
  return [
    (lng - p.origin[0]) * p.scale.mPerDegLng,
    (lat - p.origin[1]) * p.scale.mPerDegLat,
  ];
}

// ---------- Segment distances ----------

export function pointSegmentDistance(p: Pos, a: Pos, b: Pos): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  const t =
    lenSq === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq),
        );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function cross(o: Pos, a: Pos, b: Pos): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** True when the two segments share at least one point (proper crossings; touching cases fall to distance 0). */
function segmentsCross(a: Pos, b: Pos, c: Pos, d: Pos): boolean {
  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Shortest distance between two segments; 0 when they cross or touch. */
export function segmentSegmentDistance(a: Pos, b: Pos, c: Pos, d: Pos): number {
  if (segmentsCross(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

/** Edges of a ring, including the closing edge unless the ring already repeats its first point. */
export function ringEdges(
  ring: PosRing,
  closed: boolean,
): readonly (readonly [Pos, Pos])[] {
  const edges: (readonly [Pos, Pos])[] = [];
  for (let i = 0; i + 1 < ring.length; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    if (a && b) edges.push([a, b]);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (closed && first && last && (first[0] !== last[0] || first[1] !== last[1]))
    edges.push([last, first]);
  return edges;
}

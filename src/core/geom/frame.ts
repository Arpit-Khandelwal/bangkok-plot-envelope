import type { LngLat, LocalFrame, Pt } from '../types';

/**
 * Local tangent-plane frame: WGS84 geodetic -> ECEF -> ENU at the origin, keeping
 * east and north. This is an orthographic projection onto the true tangent plane of
 * the ellipsoid, so distances are exact to first order and the error grows only as
 * d^3 / R^2 (about 0.03 mm at 1 km). The inverse solves the forward map by Newton
 * iteration, seeded with the local metres-per-degree scale.
 */

const WGS84_A = 6_378_137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const DEG = Math.PI / 180;

/** Newton iterations for the inverse; each one improves the error by ~(d/R)^2. */
const INVERSE_ITERATIONS = 4;

interface Ecef {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function toEcef(lng: number, lat: number): Ecef {
  const phi = lat * DEG;
  const lambda = lng * DEG;
  const sinPhi = Math.sin(phi);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi);
  const cosPhi = Math.cos(phi);
  return {
    x: n * cosPhi * Math.cos(lambda),
    y: n * cosPhi * Math.sin(lambda),
    z: n * (1 - WGS84_E2) * sinPhi,
  };
}

/** Metres per degree of longitude and latitude at a latitude, on the WGS84 ellipsoid. */
export function metresPerDegree(latDeg: number): { readonly lng: number; readonly lat: number } {
  const phi = latDeg * DEG;
  const s = Math.sin(phi);
  const w = 1 - WGS84_E2 * s * s;
  const n = WGS84_A / Math.sqrt(w);
  const m = (WGS84_A * (1 - WGS84_E2)) / (w * Math.sqrt(w));
  return { lng: n * Math.cos(phi) * DEG, lat: m * DEG };
}

/** Frame with its origin at the centroid (vertex average) of the points. */
export function makeFrame(points: readonly LngLat[]): LocalFrame {
  const finite = points.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (finite.length === 0) return { origin: [0, 0] };
  let lng = 0;
  let lat = 0;
  for (const p of finite) {
    lng += p[0];
    lat += p[1];
  }
  return { origin: [lng / finite.length, lat / finite.length] };
}

/** Project lng/lat to local metres (x east, y north). */
export function toLocal(frame: LocalFrame, lngLat: LngLat): Pt {
  const [lng0, lat0] = frame.origin;
  const o = toEcef(lng0, lat0);
  const p = toEcef(lngLat[0], lngLat[1]);
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  const dz = p.z - o.z;
  const phi = lat0 * DEG;
  const lambda = lng0 * DEG;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLam = Math.sin(lambda);
  const cosLam = Math.cos(lambda);
  return {
    x: -sinLam * dx + cosLam * dy,
    y: -sinPhi * cosLam * dx - sinPhi * sinLam * dy + cosPhi * dz,
  };
}

/** Inverse of `toLocal`: local metres back to lng/lat on the ellipsoid surface. */
export function toLngLat(frame: LocalFrame, pt: Pt): LngLat {
  const scale = metresPerDegree(frame.origin[1]);
  let lng = frame.origin[0] + pt.x / scale.lng;
  let lat = frame.origin[1] + pt.y / scale.lat;
  for (let i = 0; i < INVERSE_ITERATIONS; i++) {
    const q = toLocal(frame, [lng, lat]);
    lng += (pt.x - q.x) / scale.lng;
    lat += (pt.y - q.y) / scale.lat;
  }
  return [lng, lat];
}

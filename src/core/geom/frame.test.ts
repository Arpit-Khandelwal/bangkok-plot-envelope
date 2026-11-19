import { describe, expect, it } from 'vitest';
import type { LngLat } from '../types';
import { makeFrame, metresPerDegree, toLngLat, toLocal } from './frame';

/** Independent reference: Vincenty inverse geodesic distance on WGS84. */
function vincenty(p1: LngLat, p2: LngLat): number {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const b = a * (1 - f);
  const rad = Math.PI / 180;
  const L = (p2[0] - p1[0]) * rad;
  const U1 = Math.atan((1 - f) * Math.tan(p1[1] * rad));
  const U2 = Math.atan((1 - f) * Math.tan(p2[1] * rad));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);
  let lambda = L;
  let sinSigma = 0;
  let cosSigma = 0;
  let sigma = 0;
  let cos2Alpha = 0;
  let cos2SigmaM = 0;
  for (let i = 0; i < 200; i++) {
    const sinL = Math.sin(lambda);
    const cosL = Math.cos(lambda);
    sinSigma = Math.sqrt((cosU2 * sinL) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosL) ** 2);
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosL;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinL) / sinSigma;
    cos2Alpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSigma - (2 * sinU1 * sinU2) / cos2Alpha;
    const C = (f / 16) * cos2Alpha * (4 + f * (4 - 3 * cos2Alpha));
    const prev = lambda;
    lambda =
      L +
      (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    if (Math.abs(lambda - prev) < 1e-13) break;
  }
  const u2 = (cos2Alpha * (a * a - b * b)) / (b * b);
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const dSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
          (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));
  return b * A * (sigma - dSigma);
}

const ORIGIN: LngLat = [100.609, 13.689];
const frame = { origin: ORIGIN };

describe('makeFrame', () => {
  it('puts the origin at the average of the points', () => {
    const f = makeFrame([
      [100.6, 13.6],
      [100.62, 13.6],
      [100.62, 13.7],
      [100.6, 13.7],
    ]);
    expect(f.origin[0]).toBeCloseTo(100.61, 12);
    expect(f.origin[1]).toBeCloseTo(13.65, 12);
  });

  it('ignores non-finite points', () => {
    const f = makeFrame([
      [100, 13],
      [Number.NaN, 13],
      [102, 15],
    ]);
    expect(f.origin).toEqual([101, 14]);
  });
});

describe('toLocal / toLngLat', () => {
  it('maps the origin to (0, 0)', () => {
    const p = toLocal(frame, ORIGIN);
    expect(Math.abs(p.x)).toBeLessThan(1e-9);
    expect(Math.abs(p.y)).toBeLessThan(1e-9);
  });

  it('uses x east and y north', () => {
    const east = toLocal(frame, [ORIGIN[0] + 0.001, ORIGIN[1]]);
    const north = toLocal(frame, [ORIGIN[0], ORIGIN[1] + 0.001]);
    expect(east.x).toBeGreaterThan(100);
    expect(Math.abs(east.y)).toBeLessThan(0.01);
    expect(north.y).toBeGreaterThan(100);
    expect(Math.abs(north.x)).toBeLessThan(1e-9);
  });

  it('round-trips points up to 1 km away to better than 1e-9 degrees', () => {
    const offsets: Array<readonly [number, number]> = [
      [0, 0],
      [1000, 0],
      [0, -1000],
      [707, 707],
      [-1000, 1000],
      [0.123, -456.789],
    ];
    for (const [x, y] of offsets) {
      const ll = toLngLat(frame, { x, y });
      const back = toLocal(frame, ll);
      expect(Math.abs(back.x - x)).toBeLessThan(1e-6);
      expect(Math.abs(back.y - y)).toBeLessThan(1e-6);
      const ll2 = toLngLat(frame, toLocal(frame, ll));
      expect(Math.abs(ll2[0] - ll[0])).toBeLessThan(1e-9);
      expect(Math.abs(ll2[1] - ll[1])).toBeLessThan(1e-9);
    }
  });

  it('matches the Vincenty geodesic distance to well under 1 cm over 1 km', () => {
    const pairs: Array<readonly [LngLat, LngLat]> = [
      [ORIGIN, toLngLat(frame, { x: 1000, y: 0 })],
      [ORIGIN, toLngLat(frame, { x: 0, y: 1000 })],
      [toLngLat(frame, { x: -500, y: -500 }), toLngLat(frame, { x: 500, y: 500 })],
      [toLngLat(frame, { x: -700, y: 400 }), toLngLat(frame, { x: 300, y: 400 })],
    ];
    for (const [a, b] of pairs) {
      const pa = toLocal(frame, a);
      const pb = toLocal(frame, b);
      const local = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      expect(Math.abs(local - vincenty(a, b))).toBeLessThan(0.002);
    }
  });

  it('gives the known length of 0.01 degree of latitude near Bangkok', () => {
    // Meridian arc 13.684..13.694 deg on WGS84 is 1106.36 m (about 110,636 m per degree).
    const a: LngLat = [100.609, 13.684];
    const b: LngLat = [100.609, 13.694];
    const ref = vincenty(a, b);
    expect(ref).toBeCloseTo(1106.36, 1);
    const pa = toLocal(frame, a);
    const pb = toLocal(frame, b);
    expect(Math.abs(Math.hypot(pb.x - pa.x, pb.y - pa.y) - ref)).toBeLessThan(0.002);
  });
});

describe('metresPerDegree', () => {
  it('gives the WGS84 values at 13.7 degrees', () => {
    const m = metresPerDegree(13.7);
    expect(m.lat).toBeGreaterThan(110_600);
    expect(m.lat).toBeLessThan(110_660);
    expect(m.lng).toBeGreaterThan(108_150);
    expect(m.lng).toBeLessThan(108_250);
  });
});

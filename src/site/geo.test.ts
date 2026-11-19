import { describe, expect, it } from "vitest";
import {
  makeProjection,
  parseGeometry,
  pointInPolygon,
  projectPos,
  segmentSegmentDistance,
  type Pos,
} from "./geo";

const WGS84_A = 6378137;
const WGS84_E2 = 0.00669437999014;

function toEcef([lng, lat]: Pos): readonly [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lam = (lng * Math.PI) / 180;
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(phi) ** 2);
  return [
    n * Math.cos(phi) * Math.cos(lam),
    n * Math.cos(phi) * Math.sin(lam),
    n * (1 - WGS84_E2) * Math.sin(phi),
  ];
}

function chordM(a: Pos, b: Pos): number {
  const [ax, ay, az] = toEcef(a);
  const [bx, by, bz] = toEcef(b);
  return Math.hypot(ax - bx, ay - by, az - bz);
}

describe("flat projection", () => {
  it("matches the WGS84 chord distance to well under 0.5 m at 1 km in every direction", () => {
    // Arrange
    const origin: Pos = [100.6, 13.7];
    const projection = makeProjection(origin);
    const offsets: readonly Pos[] = [
      [0.0093, 0],
      [0, 0.009],
      [0.0066, 0.0064],
      [-0.0066, 0.0064],
    ];

    for (const [dx, dy] of offsets) {
      // Act
      const target: Pos = [origin[0] + dx, origin[1] + dy];
      const [x, y] = projectPos(projection, target);

      // Assert
      expect(Math.abs(Math.hypot(x, y) - chordM(origin, target))).toBeLessThan(
        0.05,
      );
    }
  });
});

describe("segmentSegmentDistance", () => {
  it("is 0 when the segments cross", () => {
    expect(segmentSegmentDistance([0, 0], [10, 10], [0, 10], [10, 0])).toBe(0);
  });

  it("measures endpoint to segment for parallel segments", () => {
    expect(
      segmentSegmentDistance([0, 0], [10, 0], [12, 3], [20, 3]),
    ).toBeCloseTo(Math.hypot(2, 3), 9);
  });
});

describe("parseGeometry", () => {
  it("ignores null, malformed and unknown geometries", () => {
    expect(parseGeometry(null).polygons).toHaveLength(0);
    expect(
      parseGeometry({ type: "Polygon", coordinates: [] }).polygons,
    ).toHaveLength(0);
    expect(
      parseGeometry({ type: "Point", coordinates: ["a", 1] }).points,
    ).toHaveLength(0);
    expect(
      parseGeometry({ type: "Banana", coordinates: [1, 2] }).points,
    ).toHaveLength(0);
  });

  it("flattens geometry collections", () => {
    const g = parseGeometry({
      type: "GeometryCollection",
      geometries: [
        { type: "Point", coordinates: [1, 2] },
        {
          type: "LineString",
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
    });
    expect([g.points.length, g.lines.length]).toEqual([1, 1]);
  });
});

describe("pointInPolygon", () => {
  const outer: readonly Pos[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  const hole: readonly Pos[] = [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
  ];

  it("excludes points inside a hole", () => {
    expect(pointInPolygon([5, 5], [outer, hole])).toBe(false);
    expect(pointInPolygon([2, 2], [outer, hole])).toBe(true);
  });
});

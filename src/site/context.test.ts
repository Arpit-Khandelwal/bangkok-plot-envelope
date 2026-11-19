import type { Feature, FeatureCollection, Geometry } from "geojson";
import { describe, expect, it } from "vitest";
import type { LngLat } from "../core/types";
import { locateZone, nearestStation } from "./context";
import type { SiteData, StationProperties, ZoneProperties } from "./siteData";

// ---------- Fixtures ----------

type MutLngLat = [number, number];

const CENTRE: MutLngLat = [100.5, 13.7];
/** Metres per degree at 13.7 N on WGS84, computed by hand from the standard series. */
const M_PER_DEG_LNG = 108173.3;
const M_PER_DEG_LAT = 110636.8;
const HALF_SIDE_M = 20;
const THRESHOLD_M = 500;
const TOLERANCE_M = 0.2;

function offset(base: LngLat, eastM: number, northM: number): MutLngLat {
  return [base[0] + eastM / M_PER_DEG_LNG, base[1] + northM / M_PER_DEG_LAT];
}

/** Axis-aligned square (counter-clockwise) around `centre`, half side in metres. */
function square(centre: LngLat, halfM: number): MutLngLat[] {
  return [
    offset(centre, -halfM, -halfM),
    offset(centre, halfM, -halfM),
    offset(centre, halfM, halfM),
    offset(centre, -halfM, halfM),
  ];
}

function closed(ring: readonly MutLngLat[]): MutLngLat[] {
  const first = ring[0];
  return first ? [...ring, first] : [...ring];
}

function zoneFeature(
  zone: string,
  geometry: Geometry,
  planVersion = "2556",
): Feature<Geometry, ZoneProperties> {
  return {
    type: "Feature",
    geometry,
    properties: { id: 0, zone, category: "test", planVersion },
  };
}

function stationFeature(
  name: string,
  geometry: Geometry | null,
  extra: Partial<StationProperties> = {},
): Feature<Geometry, StationProperties> {
  return {
    type: "Feature",
    geometry: geometry as Geometry,
    properties: {
      name,
      geomSource: geometry?.type === "Point" ? "node" : "platform",
      ...extra,
    },
  };
}

function zones(
  ...features: Feature<Geometry, ZoneProperties>[]
): SiteData["zones"] {
  return { type: "FeatureCollection", features } satisfies FeatureCollection<
    Geometry,
    ZoneProperties
  >;
}

function stations(
  ...features: Feature<Geometry, StationProperties>[]
): SiteData["stations"] {
  return { type: "FeatureCollection", features } satisfies FeatureCollection<
    Geometry,
    StationProperties
  >;
}

function polygonAround(centre: LngLat, halfM: number): Geometry {
  return { type: "Polygon", coordinates: [closed(square(centre, halfM))] };
}

const PLOT = square(CENTRE, HALF_SIDE_M);
const EAST_EDGE_X = HALF_SIDE_M;

// ---------- locateZone ----------

describe("locateZone", () => {
  it("reports a single zone when the plot lies fully inside one zone", () => {
    // Arrange
    const data = zones(zoneFeature("ย.7", polygonAround(CENTRE, 500)));

    // Act
    const result = locateZone(PLOT, data);

    // Assert
    expect(result).toEqual({
      status: "single",
      zone: { code: "ย.7", planVersion: "2556" },
    });
  });

  it("reports straddles with both zones when the plot crosses a boundary between them", () => {
    // Arrange: west half of the area is zone A, east half is zone B, boundary through the plot centre.
    const west: Geometry = {
      type: "Polygon",
      coordinates: [
        closed([
          offset(CENTRE, -500, -500),
          offset(CENTRE, 0, -500),
          offset(CENTRE, 0, 500),
          offset(CENTRE, -500, 500),
        ]),
      ],
    };
    const east: Geometry = {
      type: "Polygon",
      coordinates: [
        closed([
          offset(CENTRE, 0, -500),
          offset(CENTRE, 500, -500),
          offset(CENTRE, 500, 500),
          offset(CENTRE, 0, 500),
        ]),
      ],
    };
    const data = zones(zoneFeature("ย.7", west), zoneFeature("ย.8", east));

    // Act
    const result = locateZone(PLOT, data);

    // Assert
    expect(result.status).toBe("straddles");
    if (result.status === "straddles") {
      expect(result.zones.map((z) => z.code).sort()).toEqual(["ย.7", "ย.8"]);
    }
  });

  it("reports straddles with the single zone when the plot hangs over the edge of mapped land", () => {
    // Arrange: zone ends at the plot centre line, so half of the plot is unmapped.
    const half: Geometry = {
      type: "Polygon",
      coordinates: [
        closed([
          offset(CENTRE, -500, -500),
          offset(CENTRE, 0, -500),
          offset(CENTRE, 0, 500),
          offset(CENTRE, -500, 500),
        ]),
      ],
    };

    // Act
    const result = locateZone(PLOT, zones(zoneFeature("ย.7", half)));

    // Assert
    expect(result).toEqual({
      status: "straddles",
      zones: [{ code: "ย.7", planVersion: "2556" }],
    });
  });

  it("reports outside when the plot touches no zone", () => {
    // Arrange
    const far = offset(CENTRE, 5000, 5000);

    // Act
    const result = locateZone(
      PLOT,
      zones(zoneFeature("ย.7", polygonAround(far, 100))),
    );

    // Assert
    expect(result).toEqual({ status: "outside" });
  });

  it("reports outside for an empty plot, a two-point plot and an empty zone set", () => {
    const data = zones(zoneFeature("ย.7", polygonAround(CENTRE, 500)));
    expect(locateZone([], data)).toEqual({ status: "outside" });
    expect(locateZone([CENTRE, offset(CENTRE, 10, 0)], data)).toEqual({
      status: "outside",
    });
    expect(locateZone(PLOT, zones())).toEqual({ status: "outside" });
  });

  it("treats a plot inside a hole of the zone as outside the zone", () => {
    // Arrange: 500 m zone with a 100 m hole around the plot.
    const holed: Geometry = {
      type: "Polygon",
      coordinates: [
        closed(square(CENTRE, 500)),
        closed(square(CENTRE, 100)).reverse(),
      ],
    };

    // Act
    const result = locateZone(PLOT, zones(zoneFeature("ย.7", holed)));

    // Assert
    expect(result).toEqual({ status: "outside" });
  });

  it("finds a zone given as a MultiPolygon whose second member contains the plot", () => {
    // Arrange
    const far = offset(CENTRE, 5000, 0);
    const multi: Geometry = {
      type: "MultiPolygon",
      coordinates: [[closed(square(far, 100))], [closed(square(CENTRE, 500))]],
    };

    // Act
    const result = locateZone(PLOT, zones(zoneFeature("ก.1", multi, "2563")));

    // Assert
    expect(result).toEqual({
      status: "single",
      zone: { code: "ก.1", planVersion: "2563" },
    });
  });

  it("counts the same code in two plan versions as two distinct zones", () => {
    // Arrange
    const data = zones(
      zoneFeature("ย.7", polygonAround(CENTRE, 500), "2556"),
      zoneFeature("ย.7", polygonAround(CENTRE, 500), "2563"),
    );

    // Act
    const result = locateZone(PLOT, data);

    // Assert
    expect(result.status).toBe("straddles");
  });

  it("skips malformed zone features without throwing", () => {
    // Arrange
    const bad = {
      type: "Feature",
      geometry: null,
      properties: null,
    } as unknown as Feature<Geometry, ZoneProperties>;
    const empty = zoneFeature("ย.9", { type: "Polygon", coordinates: [] });
    const good = zoneFeature("ย.7", polygonAround(CENTRE, 500));

    // Act
    const result = locateZone(PLOT, zones(bad, empty, good));

    // Assert
    expect(result.status).toBe("single");
  });
});

// ---------- nearestStation ----------

describe("nearestStation", () => {
  it("measures 500 m to a station point due east of the east edge", () => {
    // Arrange
    const point: Geometry = {
      type: "Point",
      coordinates: offset(CENTRE, EAST_EDGE_X + THRESHOLD_M, 0),
    };

    // Act
    const result = nearestStation(
      PLOT,
      stations(stationFeature("East", point, { ref: "E1" })),
    );

    // Assert
    expect(result?.name).toBe("East");
    expect(result?.ref).toBe("E1");
    expect(result?.geomSource).toBe("node");
    expect(Math.abs((result?.distanceM ?? 0) - THRESHOLD_M)).toBeLessThan(
      TOLERANCE_M,
    );
  });

  it("measures 500 m to a station point due north of the north edge", () => {
    // Arrange
    const point: Geometry = {
      type: "Point",
      coordinates: offset(CENTRE, 0, HALF_SIDE_M + THRESHOLD_M),
    };

    // Act
    const result = nearestStation(
      PLOT,
      stations(stationFeature("North", point)),
    );

    // Assert
    expect(result?.ref).toBeNull();
    expect(Math.abs((result?.distanceM ?? 0) - THRESHOLD_M)).toBeLessThan(
      TOLERANCE_M,
    );
  });

  it("returns 0 when a platform line passes through the plot", () => {
    // Arrange: a line crossing the plot with both endpoints outside it.
    const line: Geometry = {
      type: "LineString",
      coordinates: [offset(CENTRE, -100, 5), offset(CENTRE, 100, 5)],
    };

    // Act
    const result = nearestStation(
      PLOT,
      stations(stationFeature("Through", line)),
    );

    // Assert
    expect(result?.distanceM).toBe(0);
    expect(result?.geomSource).toBe("platform");
  });

  it("returns 0 when a station point lies inside the plot", () => {
    const point: Geometry = { type: "Point", coordinates: CENTRE };
    expect(
      nearestStation(PLOT, stations(stationFeature("Inside", point)))
        ?.distanceM,
    ).toBe(0);
  });

  it("returns 0 when the plot lies wholly inside a platform polygon", () => {
    const result = nearestStation(
      PLOT,
      stations(stationFeature("Big", polygonAround(CENTRE, 100))),
    );
    expect(result?.distanceM).toBe(0);
  });

  it("measures corner to edge when the platform polygon sits diagonally off a plot corner", () => {
    // Arrange: platform is a 10 m square. Its nearest feature is its bottom-left corner, which lies
    // 30 m east and 40 m north of the plot's north-east corner -> 50 m, a 3-4-5 triangle.
    const cornerX = EAST_EDGE_X + 30;
    const cornerY = HALF_SIDE_M + 40;
    const platform: Geometry = {
      type: "Polygon",
      coordinates: [
        closed([
          offset(CENTRE, cornerX, cornerY),
          offset(CENTRE, cornerX + 10, cornerY),
          offset(CENTRE, cornerX + 10, cornerY + 10),
          offset(CENTRE, cornerX, cornerY + 10),
        ]),
      ],
    };

    // Act
    const result = nearestStation(
      PLOT,
      stations(stationFeature("Corner", platform)),
    );

    // Assert
    expect(Math.abs((result?.distanceM ?? 0) - 50)).toBeLessThan(0.05);
  });

  it("measures edge to edge when a platform polygon faces a plot edge", () => {
    // Arrange: platform spans 100 m of north-south, starting 12 m east of the east edge.
    const x = EAST_EDGE_X + 12;
    const platform: Geometry = {
      type: "Polygon",
      coordinates: [
        closed([
          offset(CENTRE, x, -50),
          offset(CENTRE, x + 8, -50),
          offset(CENTRE, x + 8, 50),
          offset(CENTRE, x, 50),
        ]),
      ],
    };

    // Act
    const result = nearestStation(
      PLOT,
      stations(stationFeature("Face", platform)),
    );

    // Assert
    expect(Math.abs((result?.distanceM ?? 0) - 12)).toBeLessThan(0.05);
  });

  it("chooses the nearest of three stations", () => {
    // Arrange
    const make = (name: string, eastM: number) =>
      stationFeature(
        name,
        { type: "Point", coordinates: offset(CENTRE, EAST_EDGE_X + eastM, 0) },
        { ref: name },
      );

    // Act
    const result = nearestStation(
      PLOT,
      stations(make("far", 900), make("near", 250), make("mid", 600)),
    );

    // Assert
    expect(result?.name).toBe("near");
    expect(Math.abs((result?.distanceM ?? 0) - 250)).toBeLessThan(TOLERANCE_M);
  });

  it("still finds a station farther than the search radius when nothing is nearer", () => {
    const point: Geometry = {
      type: "Point",
      coordinates: offset(CENTRE, 10000, 0),
    };
    const result = nearestStation(
      PLOT,
      stations(stationFeature("Remote", point)),
    );
    expect(
      Math.abs((result?.distanceM ?? 0) - (10000 - EAST_EDGE_X)),
    ).toBeLessThan(1);
  });

  it("skips malformed features without throwing and still finds the valid one", () => {
    // Arrange
    const nullGeometry = stationFeature("Null", null);
    const emptyLine = stationFeature("EmptyLine", {
      type: "LineString",
      coordinates: [],
    });
    const emptyPolygon = stationFeature("EmptyPoly", {
      type: "MultiPolygon",
      coordinates: [],
    });
    const noProps = {
      type: "Feature",
      geometry: { type: "Point", coordinates: offset(CENTRE, 200, 0) },
      properties: null,
    };
    const good = stationFeature("Good", {
      type: "Point",
      coordinates: offset(CENTRE, 300, 0),
    });
    const data = stations(
      nullGeometry,
      emptyLine,
      emptyPolygon,
      noProps as unknown as Feature<Geometry, StationProperties>,
      good,
    );

    // Act
    const result = nearestStation(PLOT, data);

    // Assert
    expect(result?.distanceM).toBeGreaterThan(170);
    expect(result?.distanceM).toBeLessThan(190);
  });

  it("returns null when there are no usable stations or the plot has fewer than 3 points", () => {
    const point: Geometry = {
      type: "Point",
      coordinates: offset(CENTRE, 100, 0),
    };
    expect(nearestStation(PLOT, stations())).toBeNull();
    expect(
      nearestStation(PLOT, stations(stationFeature("Null", null))),
    ).toBeNull();
    expect(
      nearestStation(
        [CENTRE, offset(CENTRE, 5, 5)],
        stations(stationFeature("P", point)),
      ),
    ).toBeNull();
  });
});

// ---------- Real data ----------

const rawFiles = import.meta.glob<string>(
  "../../public/data/{zones,stations}.geojson",
  {
    query: "?raw",
    import: "default",
  },
);

async function loadReal(): Promise<SiteData | null> {
  try {
    const zonesLoader = rawFiles["../../public/data/zones.geojson"];
    const stationsLoader = rawFiles["../../public/data/stations.geojson"];
    if (!zonesLoader || !stationsLoader) return null;
    const zoneData = JSON.parse(await zonesLoader()) as SiteData["zones"];
    const stationData = JSON.parse(
      await stationsLoader(),
    ) as SiteData["stations"];
    if (
      !Array.isArray(zoneData.features) ||
      !Array.isArray(stationData.features)
    )
      return null;
    return {
      buildings: { type: "FeatureCollection", features: [] },
      zones: zoneData,
      stations: stationData,
    };
  } catch {
    return null;
  }
}

describe("real Bangkok data", () => {
  it("puts a small plot at BTS Punnawithi in zone ย.7 within 150 m of the station", async (ctx) => {
    // Arrange
    const data = await loadReal();
    const station = data?.stations.features.find(
      (f) => f.properties?.name === "Punnawithi",
    );
    const props = station?.properties as
      { nodeLon?: number; nodeLat?: number } | undefined;
    if (
      !data ||
      typeof props?.nodeLon !== "number" ||
      typeof props.nodeLat !== "number"
    ) {
      ctx.skip();
      return;
    }
    const plot = square([props.nodeLon, props.nodeLat], 25);

    // Act
    const zone = locateZone(plot, data.zones);
    const nearest = nearestStation(plot, data.stations);

    // Assert
    expect(zone.status === "single" ? zone.zone.code : zone.status).toBe("ย.7");
    expect(nearest?.name).toBe("Punnawithi");
    expect(nearest?.distanceM).toBeLessThan(150);
  });
});

// ---------- locateZone by area ----------

function ringAround(centre: LngLat, halfM: number): MutLngLat[] {
  return closed(square(centre, halfM));
}

describe("locateZone by area", () => {
  it("finds a pocket of another zone inside the plot that no sample point would hit", () => {
    // A 110 m plot around a 22 m pocket of ย.5 cut out of a ย.7 polygon.
    const data = zones(
      zoneFeature("ย.7", { type: "Polygon", coordinates: [ringAround(CENTRE, 500), [...ringAround(CENTRE, 11)].reverse()] }),
      zoneFeature("ย.5", polygonAround(CENTRE, 11)),
    );
    const plot = square(offset(CENTRE, 7, 9), 55);
    const result = locateZone(plot, data);
    expect(result.status).toBe("straddles");
    expect(result.status === "straddles" ? result.zones.map((z) => z.code).sort() : []).toEqual(["ย.5", "ย.7"]);
  });

  it("reports a plot inside a zone's hole as outside", () => {
    const data = zones(zoneFeature("ย.7", { type: "Polygon", coordinates: [ringAround(CENTRE, 500), [...ringAround(CENTRE, 60)].reverse()] }));
    expect(locateZone(square(CENTRE, 20), data)).toEqual({ status: "outside" });
  });

  it("treats a hole as a hole whichever way its ring winds", () => {
    const sameWound = zones(zoneFeature("ย.7", { type: "Polygon", coordinates: [ringAround(CENTRE, 500), ringAround(CENTRE, 60)] }));
    expect(locateZone(square(CENTRE, 20), sameWound)).toEqual({ status: "outside" });
  });

  it("lists all three zones a plot overlaps", () => {
    const west: Geometry = { type: "Polygon", coordinates: [closed([offset(CENTRE, -500, -500), offset(CENTRE, 0, -500), offset(CENTRE, 0, 500), offset(CENTRE, -500, 500)])] };
    const southEast: Geometry = { type: "Polygon", coordinates: [closed([offset(CENTRE, 0, -500), offset(CENTRE, 500, -500), offset(CENTRE, 500, 0), offset(CENTRE, 0, 0)])] };
    const northEast: Geometry = { type: "Polygon", coordinates: [closed([offset(CENTRE, 0, 0), offset(CENTRE, 500, 0), offset(CENTRE, 500, 500), offset(CENTRE, 0, 500)])] };
    const data = zones(zoneFeature("ย.7", west), zoneFeature("ย.8", southEast), zoneFeature("พ.5", northEast));
    const result = locateZone(square(CENTRE, 30), data);
    expect(result.status === "straddles" ? result.zones.map((z) => z.code).sort() : result.status).toEqual(["พ.5", "ย.7", "ย.8"].sort());
  });

  it("ignores a sliver under the tolerance across a zone boundary", () => {
    // 40 x 40 plot whose east edge runs 0.01 m into the next zone: 0.4 m², under 1.6 m² (0.1%).
    const west: Geometry = { type: "Polygon", coordinates: [closed([offset(CENTRE, -500, -500), offset(CENTRE, 19.99, -500), offset(CENTRE, 19.99, 500), offset(CENTRE, -500, 500)])] };
    const east: Geometry = { type: "Polygon", coordinates: [closed([offset(CENTRE, 19.99, -500), offset(CENTRE, 500, -500), offset(CENTRE, 500, 500), offset(CENTRE, 19.99, 500)])] };
    const result = locateZone(PLOT, zones(zoneFeature("ย.7", west), zoneFeature("ย.8", east)));
    expect(result).toEqual({ status: "single", zone: { code: "ย.7", planVersion: "2556" } });
  });
});

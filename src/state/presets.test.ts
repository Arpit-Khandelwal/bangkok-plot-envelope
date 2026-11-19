import { beforeAll, describe, expect, it } from 'vitest';
import type { EdgeSpec, LngLat } from '../core/types';
import { locateZone, nearestStation } from '../site/context';
import type { SiteData } from '../site/siteData';
import { PRESETS, ROAD_WIDTH_NOTE, type NamedPlotPreset } from './presets';

// ---------- Measurements (local flat projection, metres) ----------

type Point = readonly [x: number, y: number];

const DEGREES_TO_RADIANS = Math.PI / 180;
const STATION_LIMIT_M = 500;
const STATION_MARGIN_M = 40;
const MIN_AREA_M2 = 500;
const MAX_AREA_M2 = 5_000;
const LARGE_PLOT_M2 = 2_000;
const HIGH_RISE_FRONTAGE_M = 12;
const MAX_DECIMALS = 6;

function metresPerDegree(latitudeDeg: number): { readonly lng: number; readonly lat: number } {
  const phi = latitudeDeg * DEGREES_TO_RADIANS;
  return {
    lat: 111_132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi),
    lng: 111_412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi),
  };
}

function project(plot: readonly LngLat[]): readonly Point[] {
  const first = plot[0] ?? [0, 0];
  const scale = metresPerDegree(first[1]);
  return plot.map((point): Point => [(point[0] - first[0]) * scale.lng, (point[1] - first[1]) * scale.lat]);
}

function areaM2(points: readonly Point[]): number {
  const twice = points.reduce((sum, from, index) => {
    const to = points[(index + 1) % points.length] ?? from;
    return sum + from[0] * to[1] - to[0] * from[1];
  }, 0);
  return Math.abs(twice) / 2;
}

function edgeLengthsM(points: readonly Point[]): readonly number[] {
  return points.map((from, index) => {
    const to = points[(index + 1) % points.length] ?? from;
    return Math.hypot(to[0] - from[0], to[1] - from[1]);
  });
}

function cross(origin: Point, a: Point, b: Point): number {
  return (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

function isSimple(points: readonly Point[]): boolean {
  const count = points.length;
  for (let first = 0; first < count; first += 1) {
    for (let second = first + 2; second < count; second += 1) {
      const isAdjacent = first === 0 && second === count - 1;
      if (isAdjacent) continue;
      const a = points[first];
      const b = points[(first + 1) % count];
      const c = points[second];
      const d = points[(second + 1) % count];
      if (a && b && c && d && segmentsCross(a, b, c, d)) return false;
    }
  }
  return true;
}

function isConcave(points: readonly Point[]): boolean {
  const turns = points.map((point, index) => {
    const before = points[(index + points.length - 1) % points.length] ?? point;
    const after = points[(index + 1) % points.length] ?? point;
    return Math.sign(cross(before, point, after));
  });
  return turns.some((turn) => turn > 0) && turns.some((turn) => turn < 0);
}

type RoadSpec = Extract<EdgeSpec, { kind: 'road' }>;

interface RoadEdge {
  readonly index: number;
  readonly spec: RoadSpec;
  readonly lengthM: number;
}

function roadEdges(preset: NamedPlotPreset): readonly RoadEdge[] {
  const lengths = edgeLengthsM(project(preset.plot));
  return preset.edges.flatMap((spec, index): RoadEdge[] =>
    spec.kind === 'road' ? [{ index, spec, lengthM: lengths[index] ?? 0 }] : [],
  );
}

function longestFrontageM(preset: NamedPlotPreset, minRowWidthM = 0): number {
  return Math.max(0, ...roadEdges(preset).filter((edge) => edge.spec.rowWidthM >= minRowWidthM).map((edge) => edge.lengthM));
}

function decimals(value: number): number {
  return (String(value).split('.')[1] ?? '').length;
}

// ---------- Real data ----------

const rawFiles = import.meta.glob<string>('../../public/data/{zones,stations}.geojson', {
  query: '?raw',
  import: 'default',
});

async function loadSiteData(): Promise<SiteData | null> {
  const zonesLoader = rawFiles['../../public/data/zones.geojson'];
  const stationsLoader = rawFiles['../../public/data/stations.geojson'];
  if (!zonesLoader || !stationsLoader) return null;
  return {
    buildings: { type: 'FeatureCollection', features: [] },
    zones: JSON.parse(await zonesLoader()) as SiteData['zones'],
    stations: JSON.parse(await stationsLoader()) as SiteData['stations'],
  };
}

let site: SiteData | null = null;

beforeAll(async () => {
  site = await loadSiteData();
});

function presetById(id: string): NamedPlotPreset {
  const found = PRESETS.find((preset) => preset.id === id);
  if (!found) throw new Error(`No preset with id ${id}`);
  return found;
}

function stationDistanceM(preset: NamedPlotPreset): number {
  if (!site) throw new Error('Site data is not loaded');
  const nearest = nearestStation(preset.plot, site.stations);
  if (!nearest) throw new Error(`No station found for ${preset.id}`);
  return nearest.distanceM;
}

// ---------- Every preset ----------

describe('PRESETS', () => {
  it('offers between 6 and 8 examples with unique ids', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(6);
    expect(PRESETS.length).toBeLessThanOrEqual(8);
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length);
  });

  describe.each(PRESETS.map((preset) => [preset.id, preset] as const))('%s', (_id, preset) => {
    it('lies wholly inside the single zone ย.7', () => {
      if (!site) return;
      const lookup = locateZone(preset.plot, site.zones);
      expect(lookup.status).toBe('single');
      if (lookup.status === 'single') expect(lookup.zone.code).toBe('ย.7');
    });

    it('has one edge setting per plot edge and at least one road edge', () => {
      expect(preset.edges).toHaveLength(preset.plot.length);
      const roads = roadEdges(preset);
      expect(roads.length).toBeGreaterThanOrEqual(1);
      roads.forEach((edge) => {
        expect(edge.spec.roadId).not.toBe('');
        expect(edge.spec.rowWidthM).toBeGreaterThan(0);
      });
    });

    it('is a simple polygon of a plausible size with coordinates to 6 decimals', () => {
      const points = project(preset.plot);
      expect(isSimple(points)).toBe(true);
      expect(areaM2(points)).toBeGreaterThan(MIN_AREA_M2);
      expect(areaM2(points)).toBeLessThan(MAX_AREA_M2);
      preset.plot.forEach(([lng, lat]) => {
        expect(decimals(lng)).toBeLessThanOrEqual(MAX_DECIMALS);
        expect(decimals(lat)).toBeLessThanOrEqual(MAX_DECIMALS);
      });
    });

    it('describes itself in one short sentence using m²', () => {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeLessThanOrEqual(115);
      expect(preset.description).not.toMatch(/m2\b/);
    });
  });

  it('keeps the assumed-road-width note in one shared line', () => {
    expect(ROAD_WIDTH_NOTE).toMatch(/assumed/);
    PRESETS.forEach((preset) => expect(preset.description).not.toMatch(/assumed/));
  });

  it('includes at least two non-rectangular shapes, one of them concave', () => {
    const concave = PRESETS.filter((preset) => isConcave(project(preset.plot)));
    expect(concave.length).toBeGreaterThanOrEqual(1);
    expect(PRESETS.filter((preset) => preset.plot.length !== 4 || isConcave(project(preset.plot))).length).toBeGreaterThanOrEqual(1);
  });
});

// ---------- What each preset demonstrates ----------

describe('what each preset demonstrates', () => {
  it('soi-large-far: over 2,000 m2 on a 12 m soi, clearly beyond 500 m from a platform', () => {
    const preset = presetById('soi-large-far');
    expect(areaM2(project(preset.plot))).toBeGreaterThan(LARGE_PLOT_M2);
    expect(roadEdges(preset).map((edge) => edge.spec.rowWidthM)).toEqual([12]);
    if (site) expect(stationDistanceM(preset)).toBeGreaterThanOrEqual(STATION_LIMIT_M + STATION_MARGIN_M);
  });

  it('soi-large-near: the same kind of plot, clearly within 500 m of a platform', () => {
    const preset = presetById('soi-large-near');
    const far = presetById('soi-large-far');
    expect(areaM2(project(preset.plot))).toBeGreaterThan(LARGE_PLOT_M2);
    expect(areaM2(project(preset.plot))).toBeCloseTo(areaM2(project(far.plot)), -2);
    expect(roadEdges(preset).map((edge) => edge.spec.rowWidthM)).toEqual([12]);
    if (site) expect(stationDistanceM(preset)).toBeLessThanOrEqual(STATION_LIMIT_M - STATION_MARGIN_M);
  });

  it('sukhumvit-wide-frontage: 30 m or more on a 30 m road, as far from a platform as the zone allows', () => {
    const preset = presetById('sukhumvit-wide-frontage');
    expect(areaM2(project(preset.plot))).toBeGreaterThan(LARGE_PLOT_M2);
    expect(longestFrontageM(preset, 30)).toBeGreaterThanOrEqual(30);
    // No spot on Sukhumvit Road in this zone is beyond 500 m of a platform, so this is the best available.
    if (site) expect(stationDistanceM(preset)).toBeGreaterThanOrEqual(400);
  });

  it('sukhumvit-narrow-frontage: about 20 m of frontage on a 30 m road', () => {
    const preset = presetById('sukhumvit-narrow-frontage');
    const frontage = longestFrontageM(preset, 30);
    expect(frontage).toBeGreaterThanOrEqual(18);
    expect(frontage).toBeLessThanOrEqual(22);
    expect(areaM2(project(preset.plot))).toBeGreaterThan(LARGE_PLOT_M2);
    if (site) expect(stationDistanceM(preset)).toBeLessThanOrEqual(STATION_LIMIT_M - STATION_MARGIN_M);
  });

  it('small-far-binds: under 2,000 m2, so FAR rather than the size limit binds', () => {
    const preset = presetById('small-far-binds');
    expect(areaM2(project(preset.plot))).toBeLessThan(LARGE_PLOT_M2);
  });

  it('flag-narrow-access: under 12 m of road frontage on a concave plot', () => {
    const preset = presetById('flag-narrow-access');
    expect(longestFrontageM(preset)).toBeLessThan(HIGH_RISE_FRONTAGE_M);
    expect(isConcave(project(preset.plot))).toBe(true);
  });

  it('corner-two-roads: two adjacent road edges of different widths', () => {
    const preset = presetById('corner-two-roads');
    const roads = roadEdges(preset);
    expect(roads).toHaveLength(2);
    const [first, second] = roads;
    expect(new Set(roads.map((edge) => edge.spec.roadId)).size).toBe(2);
    expect(first?.spec.rowWidthM).not.toBe(second?.spec.rowWidthM);
    const gap = Math.abs((first?.index ?? 0) - (second?.index ?? 0));
    expect([1, preset.plot.length - 1]).toContain(gap);
  });

  it('office-16m-road: an office with 16 m or more of frontage on a 16 m road, beyond 500 m of a platform', () => {
    const preset = presetById('office-16m-road');
    expect(preset.buildingType).toBe('office');
    expect(roadEdges(preset).some((edge) => edge.spec.rowWidthM === 16 && edge.lengthM >= 16)).toBe(true);
    if (site) expect(stationDistanceM(preset)).toBeGreaterThanOrEqual(STATION_LIMIT_M + STATION_MARGIN_M);
  });
});

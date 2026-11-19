import { describe, expect, it } from 'vitest';
import { makeFrame, toLngLat, toLocal } from '../core/geom/frame';
import type { EdgeSpec, LngLat } from '../core/types';
import {
  framingStep,
  freeViewport,
  hasRoad,
  INITIAL_FRAMING,
  plotCamera,
  roadSideBearing,
  type ScreenRect,
} from './framing';

const ORIGIN: LngLat = [100.609, 13.6893];
const FRAME = makeFrame([ORIGIN]);

/** Plot corners given in local metres around the study area. */
function plotFromMetres(points: readonly (readonly [number, number])[]): LngLat[] {
  return points.map(([x, y]) => toLngLat(FRAME, { x, y }));
}

// Counter-clockwise 40 x 40 m square: edges south, east, north, west.
const SQUARE = plotFromMetres([
  [0, 0],
  [40, 0],
  [40, 40],
  [0, 40],
]);
const NEIGHBOUR: EdgeSpec = { kind: 'neighbour' };
const road = (rowWidthM: number): EdgeSpec => ({ kind: 'road', roadId: `r${rowWidthM}`, rowWidthM });

describe('roadSideBearing', () => {
  it('looks north from a road along the south edge', () => {
    expect(roadSideBearing(SQUARE, [road(8), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])).toBeCloseTo(0, 3);
  });

  it('looks west from a road along the east edge', () => {
    expect(roadSideBearing(SQUARE, [NEIGHBOUR, road(8), NEIGHBOUR, NEIGHBOUR])).toBeCloseTo(-90, 3);
  });

  it('looks south from a road along the north edge', () => {
    expect(Math.abs(roadSideBearing(SQUARE, [NEIGHBOUR, NEIGHBOUR, road(8), NEIGHBOUR]) ?? 0)).toBeCloseTo(180, 3);
  });

  it('gives the same answer for a clockwise ring', () => {
    const clockwise = [...SQUARE].reverse();
    // Reversed edges: north, east, south, west.
    expect(roadSideBearing(clockwise, [NEIGHBOUR, road(8), NEIGHBOUR, NEIGHBOUR])).toBeCloseTo(-90, 3);
    expect(roadSideBearing(clockwise, [NEIGHBOUR, NEIGHBOUR, road(8), NEIGHBOUR])).toBeCloseTo(0, 3);
  });

  it('picks the widest road', () => {
    expect(roadSideBearing(SQUARE, [road(6), road(12), NEIGHBOUR, NEIGHBOUR])).toBeCloseTo(-90, 3);
  });

  it('breaks a tie in width by the longer edge', () => {
    // A 60 x 20 rectangle: the south edge (60 m) beats the east edge (20 m).
    const rectangle = plotFromMetres([
      [0, 0],
      [60, 0],
      [60, 20],
      [0, 20],
    ]);
    expect(roadSideBearing(rectangle, [road(8), road(8), NEIGHBOUR, NEIGHBOUR])).toBeCloseTo(0, 3);
  });

  it('follows a slanted road', () => {
    // Road along the south-east facing edge of a diamond: look north-west.
    const diamond = plotFromMetres([
      [0, -30],
      [30, 0],
      [0, 30],
      [-30, 0],
    ]);
    expect(roadSideBearing(diamond, [road(10), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])).toBeCloseTo(-45, 3);
  });

  it('is null without a road', () => {
    expect(roadSideBearing(SQUARE, [NEIGHBOUR, NEIGHBOUR, NEIGHBOUR, NEIGHBOUR])).toBeNull();
    expect(roadSideBearing(SQUARE.slice(0, 2), [road(8)])).toBeNull();
  });
});

describe('freeViewport', () => {
  it('cuts the site bar from the top and the legend from the bottom', () => {
    const siteBar: ScreenRect = { left: 16, top: 16, right: 416, bottom: 136 };
    const legend: ScreenRect = { left: 300, top: 840, right: 840, bottom: 880 };
    expect(freeViewport(1200, 900, [siteBar, legend])).toEqual({ left: 0, top: 136, right: 1200, bottom: 840 });
  });

  it('cuts a tall narrow overlay from the side', () => {
    const column: ScreenRect = { left: 16, top: 16, right: 416, bottom: 700 };
    expect(freeViewport(1200, 900, [column])).toEqual({ left: 416, top: 0, right: 1200, bottom: 900 });
  });

  it('ignores overlays outside the map', () => {
    const above: ScreenRect = { left: 0, top: -200, right: 400, bottom: -10 };
    expect(freeViewport(800, 400, [above])).toEqual({ left: 0, top: 0, right: 800, bottom: 400 });
  });

  it('falls back to the whole map when almost nothing is free', () => {
    const cover: ScreenRect = { left: 0, top: 0, right: 760, bottom: 380 };
    expect(freeViewport(800, 400, [cover])).toEqual({ left: 0, top: 0, right: 800, bottom: 400 });
  });
});

describe('plotCamera', () => {
  const free: ScreenRect = { left: 0, top: 100, right: 1000, bottom: 800 };

  it('centres the plot and offsets it to the free area', () => {
    const camera = plotCamera({ plot: SQUARE, bearing: 0, pitch: 58, width: 1000, height: 800, free });
    expect(camera).not.toBeNull();
    const centre = toLocal(FRAME, camera?.center ?? ORIGIN);
    expect(centre.x).toBeCloseTo(20, 1);
    expect(centre.y).toBeCloseTo(20, 1);
    expect(camera?.offset).toEqual([0, 50]);
  });

  it('makes the plot about a third of the free area wide or deep', () => {
    const camera = plotCamera({ plot: SQUARE, bearing: 0, pitch: 0, width: 1000, height: 800, free, maxZoom: 30 });
    const zoom = camera?.zoom ?? 0;
    const metresPerPixel = (2 * Math.PI * 6_378_137 * Math.cos(ORIGIN[1] * (Math.PI / 180))) / (512 * 2 ** zoom);
    // The free area is 1000 x 700; the limiting side is the height: 700 * sqrt(1/3) = 404 px.
    expect(40 / metresPerPixel).toBeCloseTo(700 * Math.sqrt(1 / 3), 0);
  });

  it('zooms in further when pitched, since depth is foreshortened', () => {
    const flat = plotCamera({ plot: SQUARE, bearing: 0, pitch: 0, width: 1000, height: 800, free, maxZoom: 30 });
    const pitched = plotCamera({ plot: SQUARE, bearing: 0, pitch: 58, width: 1000, height: 800, free, maxZoom: 30 });
    expect(pitched?.zoom ?? 0).toBeGreaterThan(flat?.zoom ?? 0);
  });

  it('respects the maximum zoom', () => {
    const tiny = plotFromMetres([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    expect(plotCamera({ plot: tiny, bearing: 0, pitch: 58, width: 1000, height: 800, free })?.zoom).toBe(19);
  });

  it('is null for an empty map or plot', () => {
    expect(plotCamera({ plot: SQUARE, bearing: 0, pitch: 58, width: 0, height: 800, free })).toBeNull();
    expect(plotCamera({ plot: [], bearing: 0, pitch: 58, width: 1000, height: 800, free })).toBeNull();
  });
});

describe('framingStep', () => {
  it('frames a closed drawing and re-frames once when its first road appears', () => {
    const drawn = framingStep(INITIAL_FRAMING, { type: 'drawn', hasRoad: false });
    expect(drawn.frame).toBe(true);
    const neighbourEdit = framingStep(drawn.state, { type: 'edges', hasRoad: false });
    expect(neighbourEdit.frame).toBe(false);
    const firstRoad = framingStep(neighbourEdit.state, { type: 'edges', hasRoad: true });
    expect(firstRoad.frame).toBe(true);
    const widthChange = framingStep(firstRoad.state, { type: 'edges', hasRoad: true });
    expect(widthChange.frame).toBe(false);
    const roadRemovedAndBack = framingStep(framingStep(widthChange.state, { type: 'edges', hasRoad: false }).state, {
      type: 'edges',
      hasRoad: true,
    });
    expect(roadRemovedAndBack.frame).toBe(false);
  });

  it('frames a preset and never re-frames for its edge edits', () => {
    const preset = framingStep({ awaitingRoad: true }, { type: 'preset' });
    expect(preset.frame).toBe(true);
    expect(framingStep(preset.state, { type: 'edges', hasRoad: true }).frame).toBe(false);
  });

  it('does not frame on clearing, and forgets a pending road', () => {
    const cleared = framingStep({ awaitingRoad: true }, { type: 'cleared' });
    expect(cleared.frame).toBe(false);
    expect(framingStep(cleared.state, { type: 'edges', hasRoad: true }).frame).toBe(false);
  });
});

describe('hasRoad', () => {
  it('detects a road edge', () => {
    expect(hasRoad([NEIGHBOUR, road(8)])).toBe(true);
    expect(hasRoad([NEIGHBOUR, { kind: 'waterway', widthM: 10 }])).toBe(false);
  });
});

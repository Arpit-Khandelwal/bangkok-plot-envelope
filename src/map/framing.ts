/**
 * Camera framing for the plot. Pure: the map view measures the screen and applies the result.
 *
 * Local metres are x east, y north (see core/geom/frame.ts). A map bearing is the compass
 * direction the top of the screen faces, in degrees clockwise from north.
 */
import { makeFrame, toLngLat, toLocal } from '../core/geom/frame';
import { signedArea } from '../core/geom/ring';
import type { EdgeSpec, LngLat, Pt } from '../core/types';

/** Pitch used whenever the plot is framed. */
export const FRAME_PITCH_DEGREES = 58;
/** Share of the unobstructed map area the plot should fill. */
export const FRAME_FILL_SHARE = 1 / 3;
export const FRAME_MAX_ZOOM = 19;
/** MapLibre's world is 512 px wide at zoom 0. */
const WORLD_TILE_PX = 512;
const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * 6_378_137;
/** Below this the free area is not worth framing into; the whole map is used instead. */
const MIN_FREE_PX = 120;
/** A plot is never treated as smaller than this, so a degenerate one gets a sane zoom. */
const MIN_EXTENT_M = 5;
const DEG = Math.PI / 180;

function normalizeBearing(degrees: number): number {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped + 0;
}

/**
 * The bearing that puts the camera over the widest road, looking across it into the plot: the
 * compass direction pointing from that road into the plot. Equal widths go to the longer edge.
 * Null when no edge is a road (keep the current bearing then).
 */
export function roadSideBearing(plot: readonly LngLat[], edges: readonly EdgeSpec[]): number | null {
  if (plot.length < 3) return null;
  const frame = makeFrame(plot);
  const local = plot.map((point) => toLocal(frame, point));
  const area = signedArea(local);
  if (area === 0) return null;

  interface Candidate {
    readonly width: number;
    readonly length: number;
    readonly dx: number;
    readonly dy: number;
  }
  const candidates = edges.flatMap((spec, index): Candidate[] => {
    const start = local[index];
    const end = local[(index + 1) % local.length];
    if (spec.kind !== 'road' || !start || !end) return [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    return length > 0 ? [{ width: spec.rowWidthM, length, dx, dy }] : [];
  });
  const best = candidates.reduce<Candidate | null>((current, candidate) => {
    if (!current || candidate.width > current.width) return candidate;
    return candidate.width === current.width && candidate.length > current.length ? candidate : current;
  }, null);
  if (!best) return null;

  const { dx, dy } = best;
  // Counter-clockwise rings have the interior on the left of each edge: (-dy, dx) points inward.
  const inward = area > 0 ? { x: -dy, y: dx } : { x: dy, y: -dx };
  return normalizeBearing(Math.atan2(inward.x, inward.y) / DEG);
}

/** A rectangle in CSS pixels relative to the map container's top-left corner. */
export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

function area(rect: ScreenRect): number {
  return Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
}

/**
 * The largest axis-aligned part of the map left clear by the overlays (site bar, legend). Each
 * overlay is cut away as a band from whichever side costs the least area. Overlays outside the
 * map are ignored; if the result is too small to use, the whole map is returned.
 */
export function freeViewport(width: number, height: number, overlays: readonly ScreenRect[]): ScreenRect {
  const whole: ScreenRect = { left: 0, top: 0, right: width, bottom: height };
  const free = overlays.reduce<ScreenRect>((current, overlay) => {
    const clipped: ScreenRect = {
      left: Math.max(overlay.left, current.left),
      top: Math.max(overlay.top, current.top),
      right: Math.min(overlay.right, current.right),
      bottom: Math.min(overlay.bottom, current.bottom),
    };
    if (area(clipped) <= 0) return current;
    const options: ScreenRect[] = [
      { ...current, top: clipped.bottom },
      { ...current, bottom: clipped.top },
      { ...current, left: clipped.right },
      { ...current, right: clipped.left },
    ];
    return options.reduce((best, option) => (area(option) > area(best) ? option : best));
  }, whole);
  const usable = free.right - free.left >= MIN_FREE_PX && free.bottom - free.top >= MIN_FREE_PX;
  return usable ? free : whole;
}

export interface PlotCameraInput {
  readonly plot: readonly LngLat[];
  readonly bearing: number;
  readonly pitch: number;
  readonly width: number;
  readonly height: number;
  readonly free: ScreenRect;
  readonly fillShare?: number;
  readonly maxZoom?: number;
}

export interface PlotCamera {
  readonly center: LngLat;
  readonly zoom: number;
  /** Where the plot's centre sits relative to the map's centre, in pixels (MapLibre `offset`). */
  readonly offset: readonly [x: number, y: number];
}

/**
 * Centre and zoom that make the plot fill about `fillShare` of the free area at this bearing
 * and pitch. Depth on the ground is foreshortened by cos(pitch) near the screen centre; that
 * approximation ignores perspective, which is fine for "roughly a third".
 */
export function plotCamera(input: PlotCameraInput): PlotCamera | null {
  const { plot, bearing, pitch, width, height, free } = input;
  const fillShare = input.fillShare ?? FRAME_FILL_SHARE;
  const maxZoom = input.maxZoom ?? FRAME_MAX_ZOOM;
  if (plot.length < 3 || !(width > 0) || !(height > 0)) return null;

  const frame = makeFrame(plot);
  const local = plot.map((point) => toLocal(frame, point));
  const b = bearing * DEG;
  const right = { x: Math.cos(b), y: -Math.sin(b) };
  const up = { x: Math.sin(b), y: Math.cos(b) };
  const across = local.map((p) => p.x * right.x + p.y * right.y);
  const along = local.map((p) => p.x * up.x + p.y * up.y);
  const minAcross = Math.min(...across);
  const maxAcross = Math.max(...across);
  const minAlong = Math.min(...along);
  const maxAlong = Math.max(...along);
  const midAcross = (minAcross + maxAcross) / 2;
  const midAlong = (minAlong + maxAlong) / 2;
  const centreLocal: Pt = {
    x: right.x * midAcross + up.x * midAlong,
    y: right.y * midAcross + up.y * midAlong,
  };

  const scale = Math.sqrt(fillShare);
  const targetWidth = Math.max(1, (free.right - free.left) * scale);
  const targetHeight = Math.max(1, (free.bottom - free.top) * scale);
  const plotWidth = Math.max(MIN_EXTENT_M, maxAcross - minAcross);
  const plotDepth = Math.max(MIN_EXTENT_M, maxAlong - minAlong) * Math.cos(pitch * DEG);
  const metresPerPixel = Math.max(plotWidth / targetWidth, plotDepth / targetHeight);
  const latitude = frame.origin[1] * DEG;
  const zoom = Math.log2((EARTH_CIRCUMFERENCE_M * Math.cos(latitude)) / (WORLD_TILE_PX * metresPerPixel));

  return {
    center: toLngLat(frame, centreLocal),
    zoom: Math.min(maxZoom, zoom),
    offset: [(free.left + free.right) / 2 - width / 2, (free.top + free.bottom) / 2 - height / 2],
  };
}

// ---------- When to frame ----------

export interface FramingState {
  /** A hand-drawn plot has no road yet; the first road gets one re-frame. */
  readonly awaitingRoad: boolean;
}

export type FramingEvent =
  | { readonly type: 'drawn'; readonly hasRoad: boolean }
  | { readonly type: 'preset' }
  | { readonly type: 'edges'; readonly hasRoad: boolean }
  | { readonly type: 'cleared' };

export interface FramingStep {
  readonly state: FramingState;
  readonly frame: boolean;
}

export const INITIAL_FRAMING: FramingState = { awaitingRoad: false };

/**
 * Frames when a preset loads and when a drawn plot is first closed. Corner drags and edge edits
 * never move the camera, except that the first road marked on a freshly drawn plot re-frames once
 * (the bearing can only be chosen from a road).
 */
export function framingStep(state: FramingState, event: FramingEvent): FramingStep {
  switch (event.type) {
    case 'drawn':
      return { state: { awaitingRoad: !event.hasRoad }, frame: true };
    case 'preset':
      return { state: { awaitingRoad: false }, frame: true };
    case 'edges':
      return state.awaitingRoad && event.hasRoad
        ? { state: { awaitingRoad: false }, frame: true }
        : { state, frame: false };
    case 'cleared':
      return { state: { awaitingRoad: false }, frame: false };
  }
}

export function hasRoad(edges: readonly EdgeSpec[]): boolean {
  return edges.some((spec) => spec.kind === 'road');
}

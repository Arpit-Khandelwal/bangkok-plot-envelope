import type { SectionProfile } from '../../core/types';

/** Layout of the section drawing in SVG units. One world metre is `scale` units on both axes. */

export const VIEW_WIDTH = 400;
const MARGIN_X = 10;
const MARGIN_TOP = 24;
/** Room below the ground line for two rows of dimensions and the scale bar. */
const MARGIN_BOTTOM = 64;
/** How much of the far side of the road to show, in metres. */
const FAR_SIDE_M = 4;
const REAR_MARGIN_M = 3;
const HEADROOM_SHARE = 0.18;
const MIN_HEADROOM_M = 4;
const MIN_HEIGHT_M = 12;

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export interface SectionLayout {
  readonly width: number;
  readonly height: number;
  /** SVG units per metre, the same horizontally and vertically. */
  readonly scale: number;
  /** World extent shown, in metres from the plot's road edge. */
  readonly xMinM: number;
  readonly xMaxM: number;
  readonly heightMaxM: number;
  /** y of the ground line. */
  readonly groundY: number;
  readonly toX: (distanceM: number) => number;
  readonly toY: (heightM: number) => number;
  /** Start and end of the 2:1 height-limit line, clipped to the drawing. */
  readonly limitStart: Point2;
  readonly limitEnd: Point2;
}

/** Height limit at a distance into the plot: slope x (distance + road width). */
export function limitHeightAt(profile: SectionProfile, distanceM: number): number {
  return profile.slope * (distanceM + profile.rowWidthM);
}

function tallestM(profile: SectionProfile): number {
  const floorsTop = profile.floors.reduce((top, floor) => Math.max(top, floor.topM), 0);
  return Math.max(floorsTop, profile.roofDeckCapM ?? 0, MIN_HEIGHT_M);
}

export function layoutSection(profile: SectionProfile): SectionLayout {
  const xMinM = -profile.rowWidthM - FAR_SIDE_M;
  const xMaxM = profile.plotDepthM + REAR_MARGIN_M;
  const tallest = tallestM(profile);
  const heightMaxM = tallest + Math.max(tallest * HEADROOM_SHARE, MIN_HEADROOM_M);
  const scale = (VIEW_WIDTH - 2 * MARGIN_X) / (xMaxM - xMinM);
  const groundY = MARGIN_TOP + heightMaxM * scale;
  const toX = (distanceM: number): number => MARGIN_X + (distanceM - xMinM) * scale;
  const toY = (heightM: number): number => groundY - heightM * scale;

  const startM = -profile.rowWidthM;
  const reachesTopAtM = profile.slope > 0 ? heightMaxM / profile.slope - profile.rowWidthM : xMaxM;
  const endM = Math.min(reachesTopAtM, xMaxM);
  return {
    width: VIEW_WIDTH,
    height: Math.ceil(groundY + MARGIN_BOTTOM),
    scale,
    xMinM,
    xMaxM,
    heightMaxM,
    groundY,
    toX,
    toY,
    limitStart: { x: toX(startM), y: toY(0) },
    limitEnd: { x: toX(endM), y: toY(limitHeightAt(profile, endM)) },
  };
}

/** Rough width of a label at the drawing's label size, for keeping text inside the frame. */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.56;
}

/** A label centred on `x` but pushed inward so it stays inside the drawing. */
export function clampLabelX(x: number, text: string, fontSize: number, width: number): number {
  const half = estimateTextWidth(text, fontSize) / 2;
  return Math.min(Math.max(x, MARGIN_X + half), width - MARGIN_X - half);
}

export const SECTION_MARGIN_X = MARGIN_X;

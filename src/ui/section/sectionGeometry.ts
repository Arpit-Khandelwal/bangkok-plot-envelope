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

/** Vertical room, in SVG units, that two labels need between their centres not to overlap. */
/** Label size in SVG units. At 400 units across, 13 renders at about 9.5px on a 300px column. */
export const SECTION_LABEL_SIZE = 13;
/** Half the height of the "Height limit" label box plus half a cap label, with a little air. */
export const LABEL_CLEARANCE = 18;
const LIMIT_LABEL_SIZE = SECTION_LABEL_SIZE;
const LIMIT_LABEL_OFFSET = 10;
const LIMIT_LABEL_PAD = 3;

export interface LimitLabelPlacement {
  /** Centre of the label. */
  readonly x: number;
  readonly y: number;
  /** Rotation in degrees so the text runs along the sloped line. */
  readonly angleDeg: number;
  readonly width: number;
  readonly height: number;
  /** "above" is the free side (outside the allowed envelope); "below" the building side. */
  readonly side: 'above' | 'below';
}

/** Centre of the cap label ("23 m"), which sits just above the dashed cap line. */
export function capLabelCentreY(layout: SectionLayout, capHeightM: number): number {
  return layout.toY(capHeightM) - 5 - LIMIT_LABEL_SIZE / 2 + 1;
}

/**
 * Places "Height limit" along the sloped line near its upper end, beside the line and not on
 * the building side. If that would sit within `LABEL_CLEARANCE` of the cap label vertically, or
 * outside the drawing, it moves to the other side of the line.
 */
export function placeLimitLabel(layout: SectionLayout, capHeightM: number | null, text: string): LimitLabelPlacement {
  const { limitStart, limitEnd } = layout;
  const dx = limitEnd.x - limitStart.x;
  const dy = limitEnd.y - limitStart.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const textWidth = estimateTextWidth(text, LIMIT_LABEL_SIZE);
  const width = textWidth + 2 * LIMIT_LABEL_PAD;
  const height = LIMIT_LABEL_SIZE + 2 * LIMIT_LABEL_PAD;
  const alongM = Math.min(length / 2, textWidth / 2 + 8);
  const angleDeg = (Math.atan2(uy, ux) * 180) / Math.PI;
  const capY = capHeightM === null ? null : capLabelCentreY(layout, capHeightM);

  const at = (side: 'above' | 'below'): LimitLabelPlacement => {
    const sign = side === 'above' ? 1 : -1;
    // Unit normal pointing up and to the left of the rising line.
    const nx = uy * sign;
    const ny = -ux * sign;
    return {
      x: limitEnd.x - ux * alongM + nx * LIMIT_LABEL_OFFSET,
      y: limitEnd.y - uy * alongM + ny * LIMIT_LABEL_OFFSET,
      angleDeg,
      width,
      height,
      side,
    };
  };
  const fits = (placement: LimitLabelPlacement): boolean => {
    const reach = (placement.width / 2) * Math.abs(Math.cos((angleDeg * Math.PI) / 180)) + (placement.height / 2) * Math.abs(Math.sin((angleDeg * Math.PI) / 180));
    const inside = placement.x - reach >= MARGIN_X && placement.x + reach <= layout.width - MARGIN_X;
    return inside && (capY === null || Math.abs(placement.y - capY) >= LABEL_CLEARANCE);
  };
  const above = at('above');
  if (fits(above)) return above;
  const below = at('below');
  return fits(below) ? below : above;
}

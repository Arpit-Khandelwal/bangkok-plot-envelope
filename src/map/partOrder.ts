/**
 * Which building part to fetch next, which parts matter for framing a plot, and when a plot
 * framed before its surroundings arrived should be framed again. Pure.
 */
import { metresPerDegree } from '../core/geom/frame';
import type { LngLat } from '../core/types';
import type { BuildingPart } from '../site/buildingParts';
import type { Bbox } from '../site/studyArea';

/** Distance in metres from a point to a box, 0 inside it. Equirectangular, fine across a few km. */
export function distanceToBboxM(point: LngLat, bbox: Bbox): number {
  const [lng, lat] = point;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const scale = metresPerDegree(lat);
  const dx = Math.max(minLng - lng, 0, lng - maxLng) * scale.lng;
  const dy = Math.max(minLat - lat, 0, lat - maxLat) * scale.lat;
  return Math.hypot(dx, dy);
}

/**
 * The waiting part nearest to `focus`. Ties (both containing the focus) go to the part whose
 * centre is nearer, then to the lower index. Null when nothing is waiting.
 */
export function nextPart(waiting: readonly BuildingPart[], focus: LngLat): BuildingPart | null {
  const centreDistance = (part: BuildingPart): number => {
    const [minLng, minLat, maxLng, maxLat] = part.bbox;
    const scale = metresPerDegree(focus[1]);
    return Math.hypot(((minLng + maxLng) / 2 - focus[0]) * scale.lng, ((minLat + maxLat) / 2 - focus[1]) * scale.lat);
  };
  return waiting.reduce<BuildingPart | null>((best, part) => {
    if (!best) return part;
    const delta = distanceToBboxM(focus, part.bbox) - distanceToBboxM(focus, best.bbox);
    if (delta !== 0) return delta < 0 ? part : best;
    const centreDelta = centreDistance(part) - centreDistance(best);
    if (centreDelta !== 0) return centreDelta < 0 ? part : best;
    return part.index < best.index ? part : best;
  }, null);
}

/** Indexes of the parts whose box meets the plot's box grown by `rangeM` on every side. */
export function partsAround(parts: readonly BuildingPart[], plot: readonly LngLat[], rangeM: number): number[] {
  if (plot.length === 0) return [];
  const lngs = plot.map((point) => point[0]);
  const lats = plot.map((point) => point[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const scale = metresPerDegree((minLat + maxLat) / 2);
  const padLng = rangeM / scale.lng;
  const padLat = rangeM / scale.lat;
  const box: Bbox = [Math.min(...lngs) - padLng, minLat - padLat, Math.max(...lngs) + padLng, maxLat + padLat];
  return parts
    .filter(({ bbox }) => bbox[0] <= box[2] && bbox[2] >= box[0] && bbox[1] <= box[3] && bbox[3] >= box[1])
    .map((part) => part.index);
}

export interface ReframeInput {
  /** Key of the plot that was framed while the parts around it were still loading, or null. */
  readonly pendingPlotKey: string | null;
  /** Key of the plot now in the store, or null without a plot. */
  readonly currentPlotKey: string | null;
  /** The user has moved the camera themselves since the app last framed the plot. */
  readonly userMoved: boolean;
  /** Every part around the plot has finished loading (or failed). */
  readonly surroundingsSettled: boolean;
}

/**
 * Frame again, once, when the surroundings of a plot framed too early have arrived, unless the
 * user has taken the camera since or the plot is no longer the one that was framed.
 */
export function shouldReframe(input: ReframeInput): boolean {
  return (
    input.pendingPlotKey !== null &&
    input.pendingPlotKey === input.currentPlotKey &&
    !input.userMoved &&
    input.surroundingsSettled
  );
}

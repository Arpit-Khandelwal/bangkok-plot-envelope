import type { LngLat } from '../core/types';

/** minLng, minLat, maxLng, maxLat (WGS84). */
export type Bbox = readonly [minLng: number, minLat: number, maxLng: number, maxLat: number];

/**
 * The box the building footprints and roads were baked for (`study.bbox` in
 * public/data/meta.json; a test keeps the two equal). Kept as a constant so the check needs no
 * request at startup.
 */
export const STUDY_BBOX: Bbox = [100.585803, 13.675244, 100.622043, 13.712039];

export const OUTSIDE_STUDY_AREA_NOTE = 'Surrounding buildings are shown only around Bang Chak and Punnawithi.';

/** Area centroid of the plot outline, falling back to the corner average for a degenerate ring. */
export function plotCentroid(plot: readonly LngLat[]): LngLat | null {
  if (plot.length === 0) return null;
  const [originLng, originLat] = plot.reduce<[number, number]>(
    (sum, [lng, lat]) => [sum[0] + lng / plot.length, sum[1] + lat / plot.length],
    [0, 0],
  );
  let doubleArea = 0;
  let cx = 0;
  let cy = 0;
  plot.forEach((point, index) => {
    const next = plot[(index + 1) % plot.length] ?? point;
    const ax = point[0] - originLng;
    const ay = point[1] - originLat;
    const bx = next[0] - originLng;
    const by = next[1] - originLat;
    const cross = ax * by - bx * ay;
    doubleArea += cross;
    cx += (ax + bx) * cross;
    cy += (ay + by) * cross;
  });
  if (Math.abs(doubleArea) < 1e-18) return [originLng, originLat];
  return [originLng + cx / (3 * doubleArea), originLat + cy / (3 * doubleArea)];
}

/** Whether the plot's centroid lies inside the box (edges count as inside). An empty plot is not. */
export function isInsideStudyArea(plot: readonly LngLat[], bbox: Bbox = STUDY_BBOX): boolean {
  const centre = plotCentroid(plot);
  if (!centre) return false;
  const [lng, lat] = centre;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

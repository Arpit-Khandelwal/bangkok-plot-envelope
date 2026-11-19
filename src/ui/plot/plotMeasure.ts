import { makeFrame, toLocal } from '../../core/geom/frame';
import type { LngLat, Site } from '../../core/types';

export interface PlotMeasure {
  readonly areaM2: number;
  readonly perimeterM: number;
  readonly edgeLengthsM: readonly number[];
}

/**
 * Plot measurements for display. Uses the evaluated site when there is one, so the panel
 * and the results agree; otherwise measures the drawn outline directly.
 */
export function measurePlot(plot: readonly LngLat[], site: Site | null): PlotMeasure {
  if (site && site.edges.length === plot.length) {
    return { areaM2: site.areaM2, perimeterM: site.perimeterM, edgeLengthsM: site.edges.map((edge) => edge.lengthM) };
  }
  const frame = makeFrame(plot);
  const points = plot.map((point) => toLocal(frame, point));
  let twiceArea = 0;
  const edgeLengthsM = points.map((from, index) => {
    const to = points[(index + 1) % points.length] ?? from;
    twiceArea += from.x * to.y - to.x * from.y;
    return Math.hypot(to.x - from.x, to.y - from.y);
  });
  return {
    areaM2: Math.abs(twiceArea) / 2,
    perimeterM: edgeLengthsM.reduce((total, length) => total + length, 0),
    edgeLengthsM,
  };
}

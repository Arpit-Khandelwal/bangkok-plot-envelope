/**
 * Plot coordinates are kept to 7 decimal places of a degree (about 1 cm), the precision a shared
 * link carries, so the plot the app evaluates is exactly the one a link reproduces.
 */
import type { LngLat } from '../core/types';

export const COORD_DECIMALS = 7;
const SCALE = 10 ** COORD_DECIMALS;

export function roundCoord(value: number): number {
  return Math.round(value * SCALE) / SCALE;
}

export function roundPlot(plot: readonly LngLat[]): readonly LngLat[] {
  return plot.map(([lng, lat]) => [roundCoord(lng), roundCoord(lat)] as const);
}

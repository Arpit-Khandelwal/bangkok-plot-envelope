/**
 * Developer assumptions arrive from number fields and may be blank, zero or absurd. The pipeline
 * reads them through this clamp so that a bad value can never stall the floor stacking (a zero
 * floor height) or produce non-finite totals. Values inside the ranges pass through unchanged.
 */
import type { Assumptions } from '../types';

interface Range {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
}

/** Bounds are physical sanity limits, not law; legal minimums are applied separately. */
const RANGES: Readonly<Record<keyof Assumptions, Range>> = {
  floorToFloorM: { min: 2, max: 10, fallback: 3.1 },
  parkingFloorToFloorM: { min: 2.1, max: 10, fallback: 3 },
  efficiency: { min: 0, max: 1, fallback: 0.7 },
  averageUnitM2: { min: 20, max: 10_000, fallback: 35 },
  shareOfUnitsOver60M2: { min: 0, max: 1, fallback: 0.15 },
  // One perpendicular stall is 2.4 x 5 m = 12 m² before any aisle.
  parkingM2PerStall: { min: 12, max: 200, fallback: 28 },
  parapetM: { min: 0, max: 20, fallback: 1.2 },
};

function clamp(value: number, range: Range): number {
  if (!Number.isFinite(value)) return range.fallback;
  return Math.min(range.max, Math.max(range.min, value));
}

export function saneAssumptions(a: Assumptions): Assumptions {
  return {
    floorToFloorM: clamp(a.floorToFloorM, RANGES.floorToFloorM),
    parkingFloorToFloorM: clamp(a.parkingFloorToFloorM, RANGES.parkingFloorToFloorM),
    efficiency: clamp(a.efficiency, RANGES.efficiency),
    averageUnitM2: clamp(a.averageUnitM2, RANGES.averageUnitM2),
    shareOfUnitsOver60M2: clamp(a.shareOfUnitsOver60M2, RANGES.shareOfUnitsOver60M2),
    parkingM2PerStall: clamp(a.parkingM2PerStall, RANGES.parkingM2PerStall),
    parapetM: clamp(a.parapetM, RANGES.parapetM),
  };
}

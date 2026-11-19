import type { Assumptions, BuildingType } from '../core/types';

/** The conservative readings recorded in DECISIONS.md section B, defined once in the core. */
export { DEFAULT_INTERPRETATION } from '../core/readings';

/**
 * Developer norms, not law. No authoritative Bangkok source exists for these
 * (see research/01-regulations.md section 5.4), so each is shown as an editable assumption.
 */
export const DEFAULT_ASSUMPTIONS: Readonly<Record<BuildingType, Assumptions>> = {
  condo: {
    floorToFloorM: 3.1,
    parkingFloorToFloorM: 3.0,
    efficiency: 0.7,
    averageUnitM2: 35,
    shareOfUnitsOver60M2: 0.15,
    parkingM2PerStall: 28,
    parapetM: 1.2,
  },
  office: {
    floorToFloorM: 3.8,
    parkingFloorToFloorM: 3.0,
    efficiency: 0.8,
    averageUnitM2: 250,
    shareOfUnitsOver60M2: 0,
    parkingM2PerStall: 28,
    parapetM: 1.2,
  },
};

export const DEFAULT_ROAD_WIDTH_M = 8;
export const DEFAULT_WATERWAY_WIDTH_M = 8;
export const MIN_ROAD_WIDTH_M = 1;
export const MAX_ROAD_WIDTH_M = 100;

export const MAX_WATERWAY_WIDTH_M = 200;

/** The range each assumption accepts in the interface, in stored units (shares are 0 to 1). */
export const ASSUMPTION_LIMITS: Readonly<Record<keyof Assumptions, { readonly min: number; readonly max: number }>> = {
  floorToFloorM: { min: 2.6, max: 8 },
  parkingFloorToFloorM: { min: 2.4, max: 6 },
  efficiency: { min: 0.3, max: 1 },
  averageUnitM2: { min: 20, max: 2000 },
  shareOfUnitsOver60M2: { min: 0, max: 1 },
  parkingM2PerStall: { min: 20, max: 60 },
  parapetM: { min: 0, max: 10 },
};

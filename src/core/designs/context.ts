/** Everything the generator needs for one regime, gathered once. */
import { difference, largestPiece } from '../geom';
import type { AreaReading } from '../measure/areas';
import { planFarRuleIds } from '../rules';
import type { Assumptions, BuildingType, Envelope, FloorUse, Region, RegimeRules, Scenario, Site } from '../types';
import { habitable, MIN_MAIN_WIDTH_M, narrowLoss } from './habitable';
import type { NarrowLoss } from './habitable';

/** How floor areas are counted under the user's readings of the law. */
export function areaReading(scenario: Scenario): AreaReading {
  return {
    planFarRuleIds: planFarRuleIds(scenario.zone, scenario.buildingType),
    parkingCountsInFar: scenario.interpretation.parkingCountsInFar,
    parkingCountsInOperatingArea: scenario.interpretation.officeParkingCountsInOperatingArea,
  };
}

/** Display and stacking cap when a regime has no height rule at all (rules switched off). */
export const NO_HEIGHT_LIMIT_CAP_M = 150;

/** Hard stop on the number of storeys, so a plot with every limit switched off still terminates. */
export const MAX_STOREYS = 120;

export interface DesignContext {
  readonly site: Site;
  readonly regime: RegimeRules;
  readonly envelope: Envelope;
  /**
   * The largest piece of the envelope footprint with every part narrower than a usable floor removed
   * (see `habitable.ts`): one building, even on a plot split in two. Empty when the whole footprint
   * is too narrow.
   */
  readonly basePlate: Region;
  /** The part of the allowed footprint left unbuilt because it is too narrow. */
  readonly narrow: NarrowLoss;
  readonly buildingType: BuildingType;
  readonly mainUse: FloorUse;
  readonly assumptions: Assumptions;
  readonly reading: AreaReading;
  /** max(assumed floor-to-floor, legal minimum). */
  readonly mainFloorToFloorM: number;
  readonly parkingFloorToFloorM: number;
  /** The roof deck must stay strictly under this, or null for no flat cap. */
  readonly roofDeckCapM: number | null;
  /** Rule id named when the cap stops the stack. */
  readonly capRuleId: string | null;
  /**
   * Memo of habitable floor plates cut to a height (see `clipped` in stack.ts), keyed by the plate
   * below, then by the height and the minimum width. The parking search stacks the same plate many
   * times; the cut is a pure function of these.
   */
  readonly clipMemo: WeakMap<Region, Map<string, Region>>;
  /**
   * Plates known to be habitable, with the minimum width they were opened at, so a floor that the
   * height planes leave whole is not opened again. Holds the base plate and the plates sized from it.
   */
  readonly openWidths: WeakMap<Region, number>;
}

/** The roof-deck cap the generator uses: the regime's, or the display cap when no height rule is on. */
export function effectiveCap(regime: RegimeRules): { readonly capM: number | null; readonly ruleId: string | null } {
  if (regime.roofDeckCapM !== null) return { capM: regime.roofDeckCapM, ruleId: regime.roofDeckCapRuleId };
  if (regime.heightPlanes.length === 0) return { capM: NO_HEIGHT_LIMIT_CAP_M, ruleId: null };
  return { capM: null, ruleId: null };
}

export function designContext(
  site: Site,
  scenario: Scenario,
  assumptions: Assumptions,
  regime: RegimeRules,
  envelope: Envelope,
): DesignContext {
  const cap = effectiveCap(regime);
  const whole = largestPiece(envelope.footprint);
  const basePlate = habitable(whole, MIN_MAIN_WIDTH_M);
  return {
    site,
    regime,
    envelope,
    basePlate,
    narrow: narrowLoss(site, envelope.footprint, difference(whole, basePlate)),
    buildingType: scenario.buildingType,
    mainUse: scenario.buildingType === 'condo' ? 'residential' : 'office',
    assumptions,
    reading: areaReading(scenario),
    mainFloorToFloorM: Math.max(assumptions.floorToFloorM, regime.minFloorToFloorM),
    parkingFloorToFloorM: assumptions.parkingFloorToFloorM,
    roofDeckCapM: cap.capM,
    capRuleId: cap.ruleId,
    clipMemo: new WeakMap(),
    openWidths: new WeakMap([[basePlate, MIN_MAIN_WIDTH_M]]),
  };
}

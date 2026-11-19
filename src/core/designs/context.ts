/** Everything the generator needs for one regime, gathered once. */
import { largestPiece } from '../geom';
import type { AreaReading } from '../measure/areas';
import { planFarRuleIds } from '../rules';
import type { Assumptions, BuildingType, Envelope, FloorUse, Region, RegimeRules, Scenario, Site } from '../types';

/** Display and stacking cap when a regime has no height rule at all (rules switched off). */
export const NO_HEIGHT_LIMIT_CAP_M = 150;

/** Hard stop on the number of storeys, so a plot with every limit switched off still terminates. */
export const MAX_STOREYS = 120;

export interface DesignContext {
  readonly site: Site;
  readonly regime: RegimeRules;
  readonly envelope: Envelope;
  /** The largest piece of the envelope footprint: one building, even on a plot split in two. */
  readonly basePlate: Region;
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
  return {
    site,
    regime,
    envelope,
    basePlate: largestPiece(envelope.footprint),
    buildingType: scenario.buildingType,
    mainUse: scenario.buildingType === 'condo' ? 'residential' : 'office',
    assumptions,
    reading: {
      planFarRuleIds: planFarRuleIds(scenario.zone, scenario.buildingType),
      parkingCountsInFar: scenario.interpretation.parkingCountsInFar,
    },
    mainFloorToFloorM: Math.max(assumptions.floorToFloorM, regime.minFloorToFloorM),
    parkingFloorToFloorM: assumptions.parkingFloorToFloorM,
    roofDeckCapM: cap.capM,
    capRuleId: cap.ruleId,
  };
}

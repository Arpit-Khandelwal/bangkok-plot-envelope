import type { BuildingType, RegimeId } from '../../types';
import { BUILDING_CONTROL_RULES } from './building-control';
import type { RuleSpec, ZoneData } from './spec';

export { BUILDING_CONTROL_RULES } from './building-control';
export { ZONES, findZone } from './zones';
export type * from './spec';

/** Ids used in `blockedBy` when no rule data can be applied at all. */
export const BLOCK_ZONE_UNSUPPORTED = 'plan.zone-unsupported';
export const BLOCK_NO_ROAD = 'site.no-road';

function inScope(rule: RuleSpec, regime: RegimeId, buildingType: BuildingType): boolean {
  const regimeOk = rule.regimes === undefined || rule.regimes.includes(regime);
  const typeOk = rule.buildingTypes === undefined || rule.buildingTypes.includes(buildingType);
  return regimeOk && typeOk;
}

/** Zone rules first, then building-control rules, filtered to this regime and building type. */
export function rulesFor(
  zone: ZoneData,
  regime: RegimeId,
  buildingType: BuildingType,
  buildingControl: readonly RuleSpec[] = BUILDING_CONTROL_RULES,
): readonly RuleSpec[] {
  return [...zone.rules, ...buildingControl].filter((r) => inScope(r, regime, buildingType));
}

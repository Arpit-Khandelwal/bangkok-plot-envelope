/** Read-only lookups into the rule data, for the design generator and the checks. */
import type { BuildingType, Citation, ZoneRef } from '../types';
import { BUILDING_CONTROL_RULES, findZone } from './data';
import type { AccessSpec, HeightPlaneSpec, RuleSpec, UseSizeSpec, ZoneData } from './data/spec';

function zoneSpecs(zone: ZoneRef | null, buildingType: BuildingType): readonly RuleSpec[] {
  const data: ZoneData | null = findZone(zone);
  if (data === null) return [];
  return data.rules.filter((r) => r.buildingTypes === undefined || r.buildingTypes.includes(buildingType));
}

/** The zone plan's floor area ratio (the `far` rule of the zone), or 0 when the zone is unknown. */
export function planFarRatio(zone: ZoneRef | null, buildingType: BuildingType): number {
  const far = zoneSpecs(zone, buildingType).find((r) => r.kind === 'far');
  return far?.kind === 'far' ? far.ratio : 0;
}

/**
 * Ids of the zone plan's FAR rules. Only these follow the `parkingCountsInFar` reading, which is
 * a reading of the 2013 plan's floor-area definition; building-control limits count every floor.
 */
export function planFarRuleIds(zone: ZoneRef | null, buildingType: BuildingType): ReadonlySet<string> {
  return new Set(zoneSpecs(zone, buildingType).filter((r) => r.kind === 'far').map((r) => r.meta.id));
}

/** The zone's use-size rule for this building type, or null. */
export function useSizeSpec(zone: ZoneRef | null, buildingType: BuildingType): UseSizeSpec | null {
  const spec = zoneSpecs(zone, buildingType).find((r) => r.kind === 'useSize');
  return spec?.kind === 'useSize' ? spec : null;
}

/** The high-rise road-access rule (its tiers), or null. */
export function accessSpec(): AccessSpec | null {
  const spec = BUILDING_CONTROL_RULES.find((r) => r.kind === 'access');
  return spec?.kind === 'access' ? spec : null;
}

/** The road height-plane rule (its slope), or null. */
export function heightPlaneSpec(): HeightPlaneSpec | null {
  const spec = BUILDING_CONTROL_RULES.find((r) => r.kind === 'heightPlane');
  return spec?.kind === 'heightPlane' ? spec : null;
}

/** Citations of a rule by id, from the zone and building-control data. */
export function citationsOf(id: string, zone: ZoneRef | null, buildingType: BuildingType): readonly Citation[] {
  const all = [...zoneSpecs(zone, buildingType), ...BUILDING_CONTROL_RULES];
  const spec = all.find(
    (r) => r.meta.id === id && (r.buildingTypes === undefined || r.buildingTypes.includes(buildingType)),
  );
  return spec?.meta.citations ?? [];
}

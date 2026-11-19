import type { ZoneRef } from '../../core/types';
import type { ZoneLookup } from '../../site/context';

/** The one zone this tool covers. */
export const COVERED_ZONE: ZoneRef = { code: 'ย.7', planVersion: '2556' };
export const COVERED_ZONE_NAME = 'Medium-density residential';
export const COVERED_PLAN_LABEL = '2013 plan (B.E. 2556), in force';

export function isCoveredZone(zone: ZoneRef): boolean {
  return zone.code === COVERED_ZONE.code && zone.planVersion === COVERED_ZONE.planVersion;
}

/** True when the lookup found something other than a single ย.7 zone. */
export function isOutsideCoverage(lookup: ZoneLookup | null): boolean {
  if (!lookup) return false;
  return lookup.status !== 'single' || !isCoveredZone(lookup.zone);
}

/** "ย.6", "ย.6 and ย.7", "ย.5, ย.6 and ย.7". */
export function listZoneCodes(zones: readonly ZoneRef[]): string {
  const codes = [...new Set(zones.map((zone) => zone.code))];
  if (codes.length <= 1) return codes[0] ?? '';
  return `${codes.slice(0, -1).join(', ')} and ${codes[codes.length - 1] ?? ''}`;
}

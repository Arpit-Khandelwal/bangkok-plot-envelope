import type { ZoneRef } from '../../../types';
import type { ZoneData } from '../spec';
import { ZONE_2556_Y7 } from './plan-2556-y7';

/** Every zone the tool has rules for. Add a zone or plan version by adding its file here. */
export const ZONES: readonly ZoneData[] = [ZONE_2556_Y7];

export function findZone(ref: ZoneRef | null, zones: readonly ZoneData[] = ZONES): ZoneData | null {
  if (ref === null) return null;
  return zones.find((z) => z.code === ref.code && z.planVersion === ref.planVersion) ?? null;
}

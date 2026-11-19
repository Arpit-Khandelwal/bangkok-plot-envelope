/**
 * Which front-access clause of the Bangkok ordinance B.E. 2544 governs a building, and whether it is
 * met (DECISIONS.md B12). Shared by the generator and the check, so both judge the same way.
 *
 * A building is "on a public road" (อาคารอยู่ริมทางสาธารณะ) when it comes within 20 m of a road
 * edge: clause 53 asks that its road-side building line be no more than 20 m from the road, so a
 * building whose nearest face is further away cannot be on the road in the clause's sense, and
 * clause 52(6) governs it on either reading, with the open space linked to the road through open
 * ground at least 6 m wide. Every building is under exactly one of the two clauses. (A building
 * behind a flag plot's access strip is such a building; so is Form B, a block set back on purpose.)
 * `onPublicRoad` asks the same of the plot: whether its allowed plate can come that close.
 *
 *  - Not on a public road: clause 52(6), unless it is a residential building of at most 3 storeys
 *    (the clause's exception) or a building it does not list; then nothing is required.
 *  - On a public road, default reading: clause 53.
 *  - On a public road, stricter reading (`frontOpenSpaceOnPublicRoad`): clause 52(6) for every
 *    building it lists; clause 53 for the others.
 */
import { applySetbacks, largestPiece } from '../geom';
import { FRONT_FACADE_MAX_M, frontAccess, meetsClause53 } from '../measure/front-access';
import type { FrontAccess } from '../measure/front-access';
import { frontOpenSpace, frontOpenSpaceWidth, FRONT_OPEN_SPACE_M, FRONT_OPEN_SPACE_TALL_M } from '../measure/front-open-space';
import type { FrontOpenSpace } from '../measure/front-open-space';
import type { BuildingType, Region, RegimeRules, Site } from '../types';
import { habitable, MIN_MAIN_WIDTH_M } from './habitable';

/** Storeys up to which a residential building away from a public road is exempt (ข้อ 52(6)). */
const EXEMPT_RESIDENTIAL_STOREYS = 3;

const onRoadMemo = new WeakMap<RegimeRules, boolean>();

/** True when the regime's allowed plate comes within 20 m of a road edge and faces it. */
export function onPublicRoad(site: Site, regime: RegimeRules): boolean {
  const known = onRoadMemo.get(regime);
  if (known !== undefined) return known;
  const plate = habitable(largestPiece(applySetbacks(site, regime.setbacks)), MIN_MAIN_WIDTH_M);
  const fa = frontAccess(site, plate);
  const result = plate.length > 0 && fa.nearestM <= FRONT_FACADE_MAX_M && fa.facingM > 0;
  onRoadMemo.set(regime, result);
  return result;
}

/** The ข้อ 52(6) width for a building not on a public road, or null when it is exempt or not listed. */
function offRoadWidth(type: BuildingType, storeys: number, heightM: number): number | null {
  const width = frontOpenSpaceWidth(type, storeys, heightM);
  if (width === null || (type === 'condo' && storeys <= EXEMPT_RESIDENTIAL_STOREYS)) return null;
  return width;
}

export type FrontVerdict =
  | { readonly clause: 'none'; readonly met: true; readonly onRoad: false }
  | { readonly clause: 'clause53'; readonly met: boolean; readonly onRoad: true; readonly fa: FrontAccess }
  | { readonly clause: 'clause52'; readonly met: boolean; readonly onRoad: boolean; readonly os: FrontOpenSpace };

export interface FrontInput {
  readonly site: Site;
  readonly regime: RegimeRules;
  readonly strict: boolean;
  readonly buildingType: BuildingType;
  readonly storeys: number;
  readonly heightM: number;
}

export function frontVerdict(input: FrontInput, footprint: Region): FrontVerdict {
  const { site, strict, buildingType, storeys, heightM } = input;
  const fa = frontAccess(site, footprint);
  const onRoad = fa.nearestM <= FRONT_FACADE_MAX_M;
  const width = onRoad ? (strict ? frontOpenSpaceWidth(buildingType, storeys, heightM) : null) : offRoadWidth(buildingType, storeys, heightM);
  if (width !== null) {
    const os = frontOpenSpace(site, footprint, width);
    return { clause: 'clause52', met: os.meets, onRoad, os };
  }
  if (!onRoad) return { clause: 'none', met: true, onRoad: false };
  return { clause: 'clause53', met: meetsClause53(fa), onRoad: true, fa };
}

/** The open-space width the generator plans for: the wide one, which covers the narrow one. */
export const PLANNED_OPEN_SPACE_M = Math.max(FRONT_OPEN_SPACE_M, FRONT_OPEN_SPACE_TALL_M);

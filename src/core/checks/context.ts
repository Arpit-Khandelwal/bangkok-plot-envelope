/**
 * What every check reads. Checks measure the finished floors themselves; they never take numbers
 * from the generator, so a generator bug shows up as a failing check.
 */
import { regionArea, unionAll } from '../geom';
import { addFloor, NO_AREA } from '../measure/areas';
import { levelAreas, roofDeck } from '../measure/levels';
import type { AreaReading, AreaSums } from '../measure/areas';
import { citationsOf } from '../rules';
import type {
  Assumptions,
  BuildingType,
  Check,
  CheckStatus,
  Citation,
  Floor,
  Region,
  RegimeRules,
  Site,
  ZoneRef,
} from '../types';

export interface CheckInput {
  readonly site: Site;
  readonly regime: RegimeRules;
  readonly floors: readonly Floor[];
  /** Assumptions as used (after the sanity clamp). */
  readonly assumptions: Assumptions;
  /** The user's floor-to-floor assumption as entered, to explain a legal-minimum override. */
  readonly enteredFloorToFloorM: number;
  readonly buildingType: BuildingType;
  readonly zone: ZoneRef | null;
  readonly stationDistanceM: number | null;
  readonly reading: AreaReading;
  readonly disabledRuleIds: ReadonlySet<string>;
}

/** Measurements taken once from the floors and shared by the checks. */
export interface Measured {
  readonly sums: AreaSums;
  /** Union of every floor outline: the ground the building covers. */
  readonly footprint: Region;
  readonly coverageM2: number;
  readonly largestFloorM2: number;
  readonly roofDeckM: number;
}

export function measure(floors: readonly Floor[]): Measured {
  const footprint = unionAll(floors.map((f) => f.outline));
  return {
    sums: floors.reduce((s, f) => addFloor(s, f.use, regionArea(f.outline)), NO_AREA),
    footprint,
    coverageM2: regionArea(footprint),
    largestFloorM2: Math.max(0, ...levelAreas(floors, (f) => regionArea(f.outline))),
    roofDeckM: roofDeck(floors),
  };
}

/** True when the rule applies in this regime and is switched on. */
export function isEnabled(input: CheckInput, ruleId: string): boolean {
  return input.regime.rules.some((r) => r.id === ruleId && !r.disabled);
}

export function citations(input: CheckInput, ruleId: string): readonly Citation[] {
  const own = input.regime.rules.find((r) => r.id === ruleId);
  return own?.citations ?? citationsOf(ruleId, input.zone, input.buildingType);
}

export function titleOf(input: CheckInput, ruleId: string, fallback: string): string {
  return input.regime.rules.find((r) => r.id === ruleId)?.title ?? fallback;
}

export interface CheckFields {
  readonly ruleId: string;
  readonly title: string;
  readonly status: CheckStatus;
  readonly required: string;
  readonly actual: string;
}

export function makeCheck(input: CheckInput, fields: CheckFields): Check {
  return { ...fields, citations: citations(input, fields.ruleId) };
}

export function passFail(ok: boolean): CheckStatus {
  return ok ? 'pass' : 'fail';
}

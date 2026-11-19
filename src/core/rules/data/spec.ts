/**
 * Shapes of the rule data. Rules are data: each entry names a `kind` that a small resolver
 * in `../kinds` knows how to apply, plus the legal values and citations. A new requirement of
 * an existing kind is a data addition; a new kind is one resolver plus one union member here.
 */
import type { BuildingType, Citation, OpenSpaceRequirement, RegimeId, RuleCategory } from '../../types';

/** Document short names from the source key in research/01-regulations.md. */
export type SourceKey = 'Plan2556' | 'MR55' | 'MR33' | 'BMA2544' | 'MR7' | 'EIA';

export interface RuleMeta {
  /** Stable id with a document prefix, e.g. "plan.far". */
  readonly id: string;
  readonly category: RuleCategory;
  readonly title: string;
  readonly titleTh?: string;
  readonly citations: readonly Citation[];
}

/** Which scenarios a rule applies to. Omitted lists mean "all". */
export interface RuleScope {
  readonly regimes?: readonly RegimeId[];
  readonly buildingTypes?: readonly BuildingType[];
}

export type EdgeKind = 'road' | 'neighbour' | 'waterway';

/** A way to qualify for a use-size tier. Any one route in a tier's `anyOf` is enough. */
export type AccessRoute =
  | {
      readonly kind: 'road';
      readonly minRowM: number;
      /** Length of plot boundary on that road (Plan ข้อ 36). */
      readonly minFrontageM: number;
    }
  | { readonly kind: 'station'; readonly maxDistanceM: number };

/** One size band of a use test. Bands are listed in ascending order of `upToM2`. */
export interface UseTier {
  /** Upper bound of this band, inclusive. Null means unbounded. */
  readonly upToM2: number | null;
  /** Empty: allowed without condition. Otherwise one of these routes must hold. */
  readonly anyOf: readonly AccessRoute[];
}

/** One band of the road-width setback table. Bands are listed in ascending order of width. */
export interface RoadSetbackBand {
  /** Upper bound of right-of-way for this band; null means unbounded. */
  readonly untilRowM: number | null;
  /** Whether a width exactly equal to `untilRowM` falls in this band. */
  readonly includesUntil: boolean;
  readonly rule:
    | { readonly kind: 'fromCentreline'; readonly distanceM: number }
    | { readonly kind: 'shareOfRow'; readonly share: number }
    | { readonly kind: 'fromBoundary'; readonly distanceM: number };
}

export interface WaterwayBand {
  /** The band applies when the waterway is narrower than this; null means any width. */
  readonly belowWidthM: number | null;
  readonly distanceM: number;
}

/** One tier of an access rule: a road this wide with this much frontage allows this much floor area. */
export interface AccessTier {
  readonly minRowM: number;
  readonly minFrontageM: number;
  /** Total floor area allowed with this tier, or null for no limit. */
  readonly maxGfaM2: number | null;
}

interface Base extends RuleScope {
  readonly meta: RuleMeta;
}

export interface FarSpec extends Base {
  readonly kind: 'far';
  readonly ratio: number;
  /** Phrase for the requirement, e.g. "under the zone plan". */
  readonly source: string;
  /** Extra basis text, e.g. that no bonus is included. */
  readonly note?: string;
}

export interface UseSizeSpec extends Base {
  readonly kind: 'useSize';
  readonly measure: 'totalFloorArea' | 'mainUseFloorArea';
  /** Plain name of the measured area, e.g. "total floor area" or "operating area". */
  readonly measureLabel: string;
  /** The use with its article, e.g. "a condominium". */
  readonly useLabel: string;
  readonly tiers: readonly UseTier[];
  /** How the area is counted, shown in the basis. */
  readonly note?: string;
}

export interface RegimeThresholdSpec extends Base {
  readonly kind: 'regimeThreshold';
  /** Roof deck must stay strictly under this height. */
  readonly roofDeckM: number;
  /** Total floor area, and any single floor, must stay strictly under this. */
  readonly floorAreaM2: number;
}

export interface AccessSpec extends Base {
  readonly kind: 'access';
  /** Ascending by `minRowM`. The widest tier the plot meets applies. */
  readonly tiers: readonly AccessTier[];
}

export interface RoadSetbackSpec extends Base {
  readonly kind: 'roadSetback';
  readonly bands: readonly RoadSetbackBand[];
}

export interface UniformSetbackSpec extends Base {
  readonly kind: 'uniformSetback';
  readonly distanceM: number;
  readonly appliesTo: readonly EdgeKind[];
  /** Plain description of what is kept back, e.g. "walls with windows or balconies". */
  readonly what: string;
  /** Why this applies, when it rests on an assumption. */
  readonly assumption?: string;
  /**
   * When true, the requirement says so plainly where other setbacks on this plot already keep the
   * building further back on every edge this rule covers, so the rule changes no number.
   */
  readonly noteWhenCovered?: boolean;
}

export interface WaterwaySetbackSpec extends Base {
  readonly kind: 'waterwaySetback';
  /** Ascending by `belowWidthM`, last band with null. */
  readonly bands: readonly WaterwayBand[];
}

export interface HeightPlaneSpec extends Base {
  readonly kind: 'heightPlane';
  readonly slope: number;
}

export interface OpenSpaceSpec extends Base {
  readonly kind: 'openSpace';
  readonly basis: OpenSpaceRequirement['basis'];
  readonly share: number;
}

export interface ParkingSpec extends Base {
  readonly kind: 'parking';
  readonly m2PerStall: number;
  readonly stallsPerLargeUnit: number;
  /** Unit size from which the per-unit rate applies. */
  readonly largeUnitM2: number;
  /** How the count is made, shown in the basis. */
  readonly note: string;
}

export interface FloorHeightSpec extends Base {
  readonly kind: 'floorHeight';
  readonly minFloorToFloorM: number;
  readonly roomLabel: string;
}

/** A rule shown to the user with no numeric effect on the envelope. */
export interface InfoSpec extends Base {
  readonly kind: 'info';
  readonly requirement: string;
  readonly basis?: string;
}

export type RuleSpec =
  | FarSpec
  | UseSizeSpec
  | RegimeThresholdSpec
  | AccessSpec
  | RoadSetbackSpec
  | UniformSetbackSpec
  | WaterwaySetbackSpec
  | HeightPlaneSpec
  | OpenSpaceSpec
  | ParkingSpec
  | FloorHeightSpec
  | InfoSpec;

export type RuleKind = RuleSpec['kind'];

/** Zone-level rules of one plan version. */
export interface ZoneData {
  readonly code: string;
  readonly planVersion: string;
  /** Building types this zone's data covers. A type not listed is unsupported. */
  readonly buildingTypes: readonly BuildingType[];
  readonly rules: readonly RuleSpec[];
}

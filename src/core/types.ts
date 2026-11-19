/**
 * Shared contract for the evaluation pipeline.
 *
 *   Scenario -> evaluate() -> Evaluation
 *
 * Everything in `src/core` is pure: no DOM, no map, no network, no randomness.
 * The 3D view, the checklist and the area schedule all read one Evaluation,
 * so a number can never differ between the picture and the table.
 *
 * Units: metres, square metres, degrees for lng/lat. Local coordinates are a
 * flat tangent plane centred on the plot: x east, y north, z up.
 */

// ---------- Geometry ----------

export type LngLat = readonly [lng: number, lat: number];

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Open ring: the first point is not repeated at the end. Counter-clockwise for outer rings. */
export type Ring = readonly Pt[];

export interface Polygon {
  readonly outer: Ring;
  readonly holes: readonly Ring[];
}

/** Zero or more disjoint polygons. Setbacks can split a plot or leave nothing. */
export type Region = readonly Polygon[];

/** Local tangent-plane frame used to convert between lng/lat and metres. */
export interface LocalFrame {
  readonly origin: LngLat;
}

export interface Mesh {
  /** x, y, z triples in local metres. */
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
}

// ---------- Inputs ----------

export type BuildingType = 'condo' | 'office';

/** The two legal regimes. Crossing 23 m or 10,000 m2 moves the whole building to `highRise`. */
export type RegimeId = 'lowRise' | 'highRise';

/** What lies beyond one plot edge. `edges[i]` runs from `plot[i]` to `plot[i + 1]`. */
export type EdgeSpec =
  | { readonly kind: 'neighbour' }
  | {
      readonly kind: 'road';
      /** Edges sharing a roadId belong to the same road. */
      readonly roadId: string;
      /** Right-of-way width (เขตทาง) in metres, as confirmed by the user. */
      readonly rowWidthM: number;
    }
  | { readonly kind: 'waterway'; readonly widthM: number };

export interface ZoneRef {
  /** Zone code as printed in the plan, e.g. "ย.7". */
  readonly code: string;
  /** Plan version, Buddhist-era year, e.g. "2556" for the 2013 plan. */
  readonly planVersion: string;
}

/** Developer norms. Not law. Always shown as editable assumptions. */
export interface Assumptions {
  readonly floorToFloorM: number;
  readonly parkingFloorToFloorM: number;
  /** Net sellable or lettable area as a share of non-parking floor area, 0 to 1. */
  readonly efficiency: number;
  readonly averageUnitM2: number;
  /** Share of units that are 60 m2 or larger, 0 to 1. Drives the per-unit parking rule. */
  readonly shareOfUnitsOver60M2: number;
  /** Gross parking floor area per car, including aisles and ramps. */
  readonly parkingM2PerStall: number;
  /** Height of parapet and rooftop structure above the roof deck. */
  readonly parapetM: number;
}

/** Readings of unclear law that change a number. Defaults are the conservative reading. */
export interface Interpretation {
  /** Whether parking floor area counts toward FAR. Default true (2013 plan, by inference). */
  readonly parkingCountsInFar: boolean;
  /**
   * Whether an office's own parking floors count toward its operating area (พื้นที่ประกอบการ), the
   * measure of the plan's office size limit. Default true: the definition takes in areas of continuing
   * use, and the safe reading counts the office's own car park (research/05-office-hotel-rules.md §2).
   */
  readonly officeParkingCountsInOperatingArea: boolean;
  /**
   * Whether the Bangkok ordinance ข้อ 52(6) front open space is also required of a building on a
   * public road (the stricter reading). Default false: it is read as being for buildings not on a
   * public road, and a building on one is governed by ข้อ 53 (DECISIONS.md B12).
   */
  readonly frontOpenSpaceOnPublicRoad: boolean;
}

export interface Scenario {
  /** Plot outline as drawn, open ring, at least 3 points. */
  readonly plot: readonly LngLat[];
  /** One entry per plot edge, same length as `plot`. */
  readonly edges: readonly EdgeSpec[];
  readonly buildingType: BuildingType;
  /** Zone found at the plot's location, or null if it is outside any known zone. */
  readonly zone: ZoneRef | null;
  /** Shortest distance from the plot to a mass-transit platform, or null if unknown. */
  readonly stationDistanceM: number | null;
  readonly assumptions: Assumptions;
  readonly interpretation: Interpretation;
  /** Rule ids switched off for "what if" exploration. Results are then marked hypothetical. */
  readonly disabledRuleIds: readonly string[];
}

// ---------- Rules ----------

export type Confidence =
  /** Read in the official text. */
  | 'verified'
  /** Two or more secondary sources, or inferred from verified text. */
  | 'corroborated'
  /** Our reading of unclear text, or an industry norm. */
  | 'assumption';

export interface Citation {
  /** Short document name, e.g. "Bangkok Comprehensive Plan B.E. 2556". */
  readonly document: string;
  /** Clause as printed, e.g. "ข้อ 14(1)". */
  readonly clause: string;
  readonly url: string;
  readonly confidence: Confidence;
}

export type RuleCategory = 'density' | 'openSpace' | 'setback' | 'height' | 'access' | 'parking' | 'use' | 'process';

/** One rule as it applies to this scenario, ready to display. */
export interface AppliedRule {
  /** Stable id, e.g. "plan.far", "mr33.boundary-6m". Used for toggles and checks. */
  readonly id: string;
  readonly category: RuleCategory;
  readonly title: string;
  readonly titleTh?: string;
  /** The requirement in plain words with the resolved number, e.g. "Total floor area at most 12,500 m2 (5 x plot area)". */
  readonly requirement: string;
  /** Why this value applies here, when it depends on the inputs. */
  readonly basis?: string;
  readonly citations: readonly Citation[];
  /** True when the user switched this rule off. */
  readonly disabled: boolean;
  /** True when this is the rule currently limiting floor area or shaping the envelope most. */
  readonly binding: boolean;
}

export interface EdgeSetback {
  readonly edgeIndex: number;
  readonly distanceM: number;
  /** Id of the rule that set this distance (the strictest one), or null when no rule sets one. */
  readonly ruleId: string | null;
}

/** Height limit that rises away from a road: height <= slope x (distance from edge + rowWidthM). */
export interface HeightPlane {
  readonly edgeIndex: number;
  readonly rowWidthM: number;
  readonly slope: number;
  readonly ruleId: string;
}

export interface GfaLimit {
  readonly ruleId: string;
  readonly limitM2: number;
  /**
   * Which floor area the limit counts. `mainUseFloorArea` is the office operating area
   * (พื้นที่ประกอบการ): the office floors, plus the parking floors when
   * `Interpretation.officeParkingCountsInOperatingArea` is true (the default).
   */
  readonly measure: 'totalFloorArea' | 'mainUseFloorArea';
  /** True when the area must stay strictly under the limit, e.g. under 10,000 m2 to remain low-rise. */
  readonly exclusive: boolean;
}

export interface OpenSpaceRequirement {
  readonly ruleId: string;
  readonly basis: 'plotArea' | 'totalFloorArea' | 'largestFloor';
  /** Share of the basis, 0 to 1. */
  readonly share: number;
}

export interface ParkingRule {
  /** One stall per this many m2 of floor area. */
  readonly m2PerStall: number;
  /** Stalls per dwelling unit of 60 m2 or more. 0 when the type has no per-unit rule. */
  readonly stallsPerLargeUnit: number;
  /** Null when no rule requires parking (for example, the parking rule is switched off). */
  readonly ruleId: string | null;
}

/** Everything the geometry needs for one regime, resolved from the rule data. */
export interface RegimeRules {
  readonly regime: RegimeId;
  /** False when this regime cannot be built here at all, e.g. no qualifying road for a high-rise. */
  readonly available: boolean;
  /** Rule ids that make it unavailable. Empty when available. */
  readonly blockedBy: readonly string[];
  readonly setbacks: readonly EdgeSetback[];
  readonly heightPlanes: readonly HeightPlane[];
  /** Flat cap on the roof-deck height, or null. Exclusive bound for low-rise (must stay under 23 m). */
  readonly roofDeckCapM: number | null;
  readonly roofDeckCapRuleId: string | null;
  readonly gfaLimits: readonly GfaLimit[];
  /** The smallest `totalFloorArea` limit. */
  readonly maxGfaM2: number;
  /**
   * The rule that limits this regime's floor area. Starts as the strictest floor-area limit and is
   * replaced by a geometric rule (height plane, open space) once designs show that it binds first.
   * Null when nothing limits it, e.g. every floor-area rule is switched off.
   */
  readonly bindingGfaRuleId: string | null;
  /** The rule behind `maxMainUseM2`, or null when there is none. */
  readonly bindingMainUseRuleId: string | null;
  /** The smallest `mainUseFloorArea` limit, or null when there is none. */
  readonly maxMainUseM2: number | null;
  readonly openSpace: readonly OpenSpaceRequirement[];
  readonly parking: ParkingRule;
  /** Legal minimum floor-to-floor height for this building type. */
  readonly minFloorToFloorM: number;
  readonly rules: readonly AppliedRule[];
}

// ---------- Outputs ----------

export interface EdgeInfo {
  /** Index into `site.edges`. */
  readonly index: number;
  /**
   * Index of this edge in the plot as the user drew it (`scenario.edges`). `buildSite` may reverse
   * a clockwise plot or merge duplicate corners, so it can differ from `index`. Name edges to the
   * user by this index (`edgeLetter(sourceIndex)`).
   */
  readonly sourceIndex: number;
  readonly spec: EdgeSpec;
  readonly lengthM: number;
  readonly from: Pt;
  readonly to: Pt;
}

export interface Site {
  readonly frame: LocalFrame;
  /** Plot outline in local metres, counter-clockwise. */
  readonly ring: Ring;
  readonly areaM2: number;
  readonly perimeterM: number;
  readonly edges: readonly EdgeInfo[];
}

/** The space a building may fill under one regime. */
export interface Envelope {
  /** Ground-level buildable area after all setbacks. */
  readonly footprint: Region;
  readonly footprintAreaM2: number;
  /** Highest point of the envelope. */
  readonly maxHeightM: number;
  readonly volumeM3: number;
  /** Closed surface for display. */
  readonly mesh: Mesh;
}

export type FloorUse = 'parking' | 'residential' | 'office' | 'mixed';

export interface Floor {
  /** 1 is the ground floor. */
  readonly level: number;
  readonly use: FloorUse;
  readonly baseM: number;
  readonly topM: number;
  readonly outline: Region;
  /** Area of `outline`. Every total in a design is a sum of these. */
  readonly areaM2: number;
}

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'info';

export interface Check {
  /** Id of the rule being checked. */
  readonly ruleId: string;
  readonly title: string;
  readonly status: CheckStatus;
  /** What the rule demands, with numbers. */
  readonly required: string;
  /** What this design has, with numbers. */
  readonly actual: string;
  readonly citations: readonly Citation[];
}

export interface DesignTotals {
  /** Sum of all floor areas. */
  readonly grossFloorAreaM2: number;
  /** Floor area that counts toward FAR under the current interpretation. */
  readonly farFloorAreaM2: number;
  readonly far: number;
  readonly parkingFloorAreaM2: number;
  readonly mainUseFloorAreaM2: number;
  readonly sellableAreaM2: number;
  /** Largest single floor: the ground coverage. */
  readonly coverageM2: number;
  readonly openSpaceM2: number;
  readonly storeys: number;
  readonly roofDeckHeightM: number;
  readonly topHeightM: number;
  readonly units: number;
  readonly parkingRequired: number;
  readonly parkingProvided: number;
  /** The plan's floor area ratio for this zone, from the rule data. */
  readonly allowedFar: number;
  /**
   * This design's volume divided by its regime's envelope volume, 0 to 1. Usually well under 1:
   * floor-area limits, not the envelope, are what bind.
   */
  readonly envelopeVolumeShare: number;
}

export interface Design {
  readonly id: string;
  readonly name: string;
  /** One line on the idea behind this design. */
  readonly summary: string;
  readonly regime: RegimeId;
  readonly floors: readonly Floor[];
  readonly totals: DesignTotals;
  readonly checks: readonly Check[];
  /** True when no check has status `fail`. */
  readonly passes: boolean;
  /** The building as closed solids, one per floor use, so each use can be coloured. */
  readonly massing: readonly MassingPart[];
  /** A cut through the building at right angles to the governing road, or null if there is no road. */
  readonly section: SectionProfile | null;
}

export interface MassingPart {
  readonly use: FloorUse;
  readonly mesh: Mesh;
}

/**
 * A vertical cut at right angles to the governing road edge, through the middle of the design.
 * Distances run from the plot's road edge into the plot. Heights are above ground.
 */
export interface SectionProfile {
  readonly roadEdgeIndex: number;
  readonly rowWidthM: number;
  /** Required setback from the road edge. */
  readonly setbackM: number;
  /** How far the plot extends from the road edge along this cut. */
  readonly plotDepthM: number;
  /** Height limit = slope x (distance from road edge + rowWidthM). */
  readonly slope: number;
  readonly roofDeckCapM: number | null;
  /** Where each floor sits along the cut: nearest and farthest distance from the road edge. */
  readonly floors: readonly SectionFloor[];
}

export interface SectionFloor {
  readonly level: number;
  readonly use: FloorUse;
  readonly baseM: number;
  readonly topM: number;
  readonly nearM: number;
  readonly farM: number;
}

export interface RegimeResult {
  readonly rules: RegimeRules;
  /** Null when the regime is unavailable or the setbacks leave nothing to build on. */
  readonly envelope: Envelope | null;
}

export type ProblemCode =
  | 'too-few-points'
  | 'invalid-coordinates'
  | 'self-intersecting'
  | 'zero-area'
  | 'too-small'
  | 'too-large'
  | 'edges-mismatch'
  | 'no-road'
  | 'invalid-road-width'
  | 'invalid-waterway-width'
  /** Non-blocking: the station distance was not a usable number, so it is treated as unknown. */
  | 'invalid-station-distance'
  /** Non-blocking: an assumption was outside its sane range and a different value was used. */
  | 'assumption-adjusted'
  | 'outside-zone'
  | 'unsupported-zone'
  | 'nothing-buildable'
  /** Non-blocking: a regime has no height limit because its height rules are switched off. */
  | 'height-limit-off'
  /** Non-blocking: a regime has an envelope but fewer than two concept designs fit in it. */
  | 'no-design';

export interface Problem {
  readonly code: ProblemCode;
  /** Plain-language explanation the interface can show as is. */
  readonly message: string;
  /** Blocking problems stop the evaluation. Others are shown beside a result. */
  readonly blocking: boolean;
}

export type Evaluation =
  | {
      readonly ok: false;
      readonly problems: readonly Problem[];
      /** Present when the plot itself is valid, so the interface can still show its area and edges. */
      readonly site: Site | null;
    }
  | {
      readonly ok: true;
      readonly site: Site;
      readonly problems: readonly Problem[];
      /** True when any rule is switched off, so results are not a compliance statement. */
      readonly hypothetical: boolean;
      /**
       * One plain sentence per reading of unclear law set away from its conservative default
       * (`Interpretation`), e.g. "Parking floors are not counted toward the floor area ratio.".
       * Empty when every reading is the default. Show these beside the result.
       */
      readonly nonDefaultReadings: readonly string[];
      readonly regimes: Readonly<Record<RegimeId, RegimeResult>>;
      readonly designs: readonly Design[];
    };

import type { GfaLimit, HeightPlane, OpenSpaceRequirement, ParkingRule } from '../../types';
import type { RuleContext } from '../context';
import type { RuleSpec } from '../data/spec';

/** A setback one rule asks for on one edge, before the strictest is chosen. */
export interface SetbackDemand {
  readonly edgeIndex: number;
  readonly distanceM: number;
}

/** What a rule contributes to a regime when it is enabled. */
export interface RuleEffects {
  readonly setbacks?: readonly SetbackDemand[];
  readonly heightPlanes?: readonly HeightPlane[];
  readonly roofDeckCapM?: number;
  readonly gfaLimits?: readonly GfaLimit[];
  /** True when the rule makes the regime unavailable. */
  readonly blocks?: boolean;
  readonly openSpace?: OpenSpaceRequirement;
  readonly parking?: ParkingRule;
  readonly minFloorToFloorM?: number;
}

/** A rule's text and effects for one scenario. */
export interface Resolution {
  readonly requirement: string;
  readonly basis?: string;
  readonly effects: RuleEffects;
}

/** Context plus the floor-area cap from the first pass, for rules whose wording quotes it. */
export interface ResolveInput extends RuleContext {
  /** Max total floor area of the regime, or null on the first pass. */
  readonly maxGfaM2: number | null;
}

export type Resolver<S extends RuleSpec> = (spec: S, input: ResolveInput) => Resolution;

import type { GfaLimit } from '../../types';
import type { UseSizeSpec, UseTier } from '../data/spec';
import { m2 } from '../format';
import { describeRoutes, explainRoute, FRONTAGE_ASSUMPTION, routeHolds } from './routes';
import type { ResolveInput, Resolver } from './types';

const UNCHECKED_NETWORK =
  'The onward road connection and distance conditions of clause 36 are not checked; confirm them on site.';

interface TierWalk {
  /** Largest area allowed, Infinity when unbounded. */
  readonly allowedM2: number;
  /** First tier whose condition fails, or null when every tier passed. */
  readonly failedTier: UseTier | null;
  /** The last tier with a condition that passed, or null. */
  readonly lastConditionalPassed: UseTier | null;
}

function walkTiers(spec: UseSizeSpec, input: ResolveInput): TierWalk {
  let allowedM2 = 0;
  let lastConditionalPassed: UseTier | null = null;
  for (const tier of spec.tiers) {
    const free = tier.anyOf.length === 0;
    const passes = free || tier.anyOf.some((r) => routeHolds(r, input.roads, input.stationDistanceM));
    if (!passes) return { allowedM2, failedTier: tier, lastConditionalPassed };
    if (!free) lastConditionalPassed = tier;
    allowedM2 = tier.upToM2 ?? Number.POSITIVE_INFINITY;
  }
  return { allowedM2, failedTier: null, lastConditionalPassed };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function requirementText(spec: UseSizeSpec, walk: TierWalk): string {
  const use = capitalise(spec.useLabel);
  if (walk.allowedM2 === Number.POSITIVE_INFINITY) {
    const bounds = spec.tiers.flatMap((t) => (t.upToM2 === null ? [] : [t.upToM2]));
    const threshold = bounds.length === 0 ? '' : ` beyond ${m2(Math.max(...bounds))}`;
    return `No use-size limit applies to ${spec.useLabel} on this plot: its ${spec.measureLabel} may go${threshold}, up to the other limits.`;
  }
  if (walk.allowedM2 === 0 && walk.failedTier !== null) {
    return `${use} is not allowed on this plot: it needs ${describeRoutes(walk.failedTier.anyOf)}.`;
  }
  if (walk.failedTier !== null) {
    return `${use} may have at most ${m2(walk.allowedM2)} of ${spec.measureLabel} here; more needs ${describeRoutes(walk.failedTier.anyOf)}.`;
  }
  return `${use} may have at most ${m2(walk.allowedM2)} of ${spec.measureLabel}; above that it is not allowed in this zone at all, whatever the road or station.`;
}

const PARKING_IN_OPERATING_AREA =
  'The office’s own parking floors are counted in its operating area: whether they belong to it is not settled, and counting them is the safer reading (setting: count office parking in operating area).';
const PARKING_OUT_OF_OPERATING_AREA =
  'You have chosen to leave the office’s own parking out of its operating area. That is not the conservative reading: the definition takes in areas of continuing use.';

function readingNote(spec: UseSizeSpec, input: ResolveInput): readonly string[] {
  if (spec.measure !== 'mainUseFloorArea') return [];
  return [input.officeParkingCountsInOperatingArea ? PARKING_IN_OPERATING_AREA : PARKING_OUT_OF_OPERATING_AREA];
}

function basisText(spec: UseSizeSpec, walk: TierWalk, input: ResolveInput): string {
  const tier = walk.failedTier ?? walk.lastConditionalPassed;
  const checks =
    tier === null ? [] : tier.anyOf.map((r) => explainRoute(r, input.roads, input.stationDistanceM));
  const hasRoadRoute = tier?.anyOf.some((r) => r.kind === 'road') ?? false;
  const roadNotes = hasRoadRoute ? [FRONTAGE_ASSUMPTION, UNCHECKED_NETWORK] : [];
  return [...checks, ...roadNotes, ...(spec.note === undefined ? [] : [spec.note]), ...readingNote(spec, input)].join(' ');
}

export const resolveUseSize: Resolver<UseSizeSpec> = (spec, input) => {
  const walk = walkTiers(spec, input);
  const limits: readonly GfaLimit[] = Number.isFinite(walk.allowedM2)
    ? [{ ruleId: spec.meta.id, limitM2: walk.allowedM2, measure: spec.measure, exclusive: false }]
    : [];
  return {
    requirement: requirementText(spec, walk),
    basis: basisText(spec, walk, input),
    effects: { gfaLimits: limits },
  };
};

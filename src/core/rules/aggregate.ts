/** Combines the effects of the enabled rules of one regime into RegimeRules. */
import type {
  AppliedRule,
  EdgeSetback,
  GfaLimit,
  ParkingRule,
  RegimeId,
  RegimeRules,
  RuleCategory,
  Site,
} from '../types';
import type { RuleSpec } from './data/spec';
import { m } from './format';
import { bindingHeightIds } from './height-binding';
import type { Resolution } from './kinds';

export interface ResolvedRule {
  readonly spec: RuleSpec;
  readonly resolution: Resolution;
  readonly disabled: boolean;
}

/** Display order of rule categories. */
export const CATEGORY_ORDER: readonly RuleCategory[] = [
  'use',
  'density',
  'height',
  'setback',
  'openSpace',
  'access',
  'parking',
  'process',
];

/** Used when no rule supplies a parking rate: no spaces are required. */
export const NO_PARKING: ParkingRule = { m2PerStall: Number.POSITIVE_INFINITY, stallsPerLargeUnit: 0, ruleId: null };

interface Pick {
  readonly value: number;
  readonly ruleId: string;
}

/** Smallest limit; on a tie an exclusive limit is stricter, then the first listed wins. */
export function strictestLimit(limits: readonly GfaLimit[]): Pick | null {
  let best: GfaLimit | null = null;
  for (const limit of limits) {
    const stricter =
      best === null ||
      limit.limitM2 < best.limitM2 ||
      (limit.limitM2 === best.limitM2 && limit.exclusive && !best.exclusive);
    if (stricter) best = limit;
  }
  return best === null ? null : { value: best.limitM2, ruleId: best.ruleId };
}

function strictestSetbacks(site: Site, enabled: readonly ResolvedRule[]): readonly EdgeSetback[] {
  return site.edges.map((edge) => {
    let best: EdgeSetback = { edgeIndex: edge.index, distanceM: 0, ruleId: null };
    for (const rule of enabled) {
      for (const d of rule.resolution.effects.setbacks ?? []) {
        if (d.edgeIndex === edge.index && d.distanceM > best.distanceM) {
          best = { edgeIndex: edge.index, distanceM: d.distanceM, ruleId: rule.spec.meta.id };
        }
      }
    }
    return best;
  });
}

function lowestCap(enabled: readonly ResolvedRule[]): Pick | null {
  let best: Pick | null = null;
  for (const rule of enabled) {
    const cap = rule.resolution.effects.roofDeckCapM;
    if (cap !== undefined && (best === null || cap < best.value)) {
      best = { value: cap, ruleId: rule.spec.meta.id };
    }
  }
  return best;
}

function sortByCategory(rules: readonly AppliedRule[]): readonly AppliedRule[] {
  const rank = (r: AppliedRule): number => CATEGORY_ORDER.indexOf(r.category);
  return rules
    .map((rule, i) => ({ rule, i }))
    .sort((a, b) => rank(a.rule) - rank(b.rule) || a.i - b.i)
    .map((x) => x.rule);
}

function toApplied(r: ResolvedRule, binding: ReadonlySet<string>): AppliedRule {
  const { meta } = r.spec;
  return {
    id: meta.id,
    category: meta.category,
    title: meta.title,
    ...(meta.titleTh === undefined ? {} : { titleTh: meta.titleTh }),
    requirement: r.resolution.requirement,
    ...(r.resolution.basis === undefined ? {} : { basis: r.resolution.basis }),
    citations: meta.citations,
    disabled: r.disabled,
    binding: !r.disabled && binding.has(meta.id),
  };
}

/**
 * A rule asking to be told (`noteWhenCovered`) says so in its requirement when, on every edge it
 * covers, another rule already sets a larger distance: it binds nothing on this plot.
 */
function withCoverNote(r: ResolvedRule, setbacks: readonly EdgeSetback[]): ResolvedRule {
  if (r.disabled || r.spec.kind !== 'uniformSetback' || r.spec.noteWhenCovered !== true) return r;
  const demands = r.resolution.effects.setbacks ?? [];
  const others = demands.map((d) => setbacks.find((s) => s.edgeIndex === d.edgeIndex));
  const covered = demands.length > 0 && others.every((s, i) => s !== undefined && s.distanceM > (demands[i]?.distanceM ?? 0));
  if (!covered) return r;
  const least = Math.min(...others.map((s) => s?.distanceM ?? 0));
  const note = ` Other setbacks already keep the building at least ${m(least)} from these edges on this plot, so this rule changes no number here.`;
  return { ...r, resolution: { ...r.resolution, requirement: `${r.resolution.requirement}${note}` } };
}

export function enabledLimits(resolved: readonly ResolvedRule[]): readonly GfaLimit[] {
  return resolved.filter((r) => !r.disabled).flatMap((r) => r.resolution.effects.gfaLimits ?? []);
}

/** Max total floor area of the enabled limits, Infinity when none. */
export function maxTotalFloorArea(resolved: readonly ResolvedRule[]): number {
  const totals = enabledLimits(resolved).filter((l) => l.measure === 'totalFloorArea');
  return strictestLimit(totals)?.value ?? Number.POSITIVE_INFINITY;
}

export function aggregate(
  site: Site,
  regime: RegimeId,
  resolved: readonly ResolvedRule[],
  parapetM: number,
): RegimeRules {
  const enabled = resolved.filter((r) => !r.disabled);
  const effects = enabled.map((r) => r.resolution.effects);
  const gfaLimits = enabledLimits(resolved);
  const total = strictestLimit(gfaLimits.filter((l) => l.measure === 'totalFloorArea'));
  const mainUse = strictestLimit(gfaLimits.filter((l) => l.measure === 'mainUseFloorArea'));
  const maxGfaM2 = total?.value ?? Number.POSITIVE_INFINITY;
  const setbacks = strictestSetbacks(site, enabled);
  const heightPlanes = effects.flatMap((e) => e.heightPlanes ?? []);
  const cap = lowestCap(enabled);
  const blockedBy = enabled.filter((r) => r.resolution.effects.blocks === true).map((r) => r.spec.meta.id);

  const binding = new Set<string>([
    ...(total === null ? [] : [total.ruleId]),
    ...(mainUse !== null && mainUse.value < maxGfaM2 ? [mainUse.ruleId] : []),
    ...setbacks.flatMap((s) => (s.distanceM > 0 && s.ruleId !== null ? [s.ruleId] : [])),
    ...bindingHeightIds(site, heightPlanes, setbacks, cap, parapetM),
  ]);

  const floorHeights = effects.flatMap((e) => (e.minFloorToFloorM === undefined ? [] : [e.minFloorToFloorM]));
  return {
    regime,
    available: blockedBy.length === 0,
    blockedBy,
    setbacks,
    heightPlanes,
    roofDeckCapM: cap?.value ?? null,
    roofDeckCapRuleId: cap?.ruleId ?? null,
    gfaLimits,
    maxGfaM2,
    bindingGfaRuleId: total?.ruleId ?? null,
    bindingMainUseRuleId: mainUse?.ruleId ?? null,
    maxMainUseM2: mainUse?.value ?? null,
    openSpace: effects.flatMap((e) => (e.openSpace === undefined ? [] : [e.openSpace])),
    parking: effects.find((e) => e.parking !== undefined)?.parking ?? NO_PARKING,
    minFloorToFloorM: floorHeights.length === 0 ? 0 : Math.max(...floorHeights),
    rules: sortByCategory(resolved.map((r) => toApplied(withCoverNote(r, setbacks), binding))),
  };
}

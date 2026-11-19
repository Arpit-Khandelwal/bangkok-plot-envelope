/** The allowed volume of each regime, and the problems that come with it. */
import { NO_HEIGHT_LIMIT_CAP_M } from '../designs/context';
import { edgeListText } from '../edgeNames';
import { applySetbacks, buildEnvelope } from '../geom';
import { m } from '../rules/format';
import type { Envelope, Problem, RegimeId, RegimeRules, Site } from '../types';

const REGIME_LABEL: Readonly<Record<RegimeId, string>> = { lowRise: 'low-rise', highRise: 'high-rise' };

export function regimeEnvelope(site: Site, rules: RegimeRules): Envelope | null {
  if (!rules.available) return null;
  const footprint = applySetbacks(site, rules.setbacks);
  const noHeightRule = rules.heightPlanes.length === 0 && rules.roofDeckCapM === null;
  const cap = noHeightRule ? NO_HEIGHT_LIMIT_CAP_M : rules.roofDeckCapM;
  return buildEnvelope(site, footprint, rules.heightPlanes, cap);
}

export function heightOffProblem(rules: RegimeRules): Problem | null {
  if (!rules.available || rules.heightPlanes.length > 0 || rules.roofDeckCapM !== null) return null;
  return {
    code: 'height-limit-off',
    message: `The height limit is switched off for the ${REGIME_LABEL[rules.regime]} rules, so its allowed space is drawn only up to ${m(NO_HEIGHT_LIMIT_CAP_M)}.`,
    blocking: false,
  };
}

/** "3 m from edges B, C and D (Side and rear setback ...)" for one regime. */
function setbackSummary(site: Site, rules: RegimeRules): string {
  const groups = new Map<string, { distance: number; edges: number[] }>();
  for (const s of rules.setbacks) {
    if (!(s.distanceM > 0)) continue;
    const title = rules.rules.find((r) => r.id === s.ruleId)?.title ?? 'setback';
    const key = `${title}|${s.distanceM}`;
    const prev = groups.get(key);
    groups.set(key, { distance: s.distanceM, edges: [...(prev?.edges ?? []), s.edgeIndex] });
  }
  return [...groups.entries()]
    .map(([key, g]) => `${m(g.distance)} from ${edgeListText(site, g.edges)} (${key.split('|')[0] ?? ''})`)
    .join('; ');
}

export function nothingBuildableProblem(site: Site, all: readonly RegimeRules[]): Problem {
  const parts = all
    .filter((r) => r.available)
    .map((r) => `under the ${REGIME_LABEL[r.regime]} rules, ${setbackSummary(site, r) || 'the height limit'}`);
  const detail = parts.length === 0 ? 'Neither set of rules can be applied on this plot.' : `The setbacks use up the whole plot: ${parts.join('. And ')}.`;
  return {
    code: 'nothing-buildable',
    message: `Nothing can be built on this plot. ${detail} A larger or wider plot is needed.`,
    blocking: true,
  };
}

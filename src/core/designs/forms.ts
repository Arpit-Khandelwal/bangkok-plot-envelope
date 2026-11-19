/**
 * The two lawful forms under the default front-access reading (DECISIONS.md B12), and the choice
 * between them. Form A stands on the road (within 20 m of it) and meets clause 53; Form B stands more
 * than 20 m back, behind the clause 52(6) front open space. Each variant is generated in both forms
 * where each can win and checked on its own; the one with more floor area counted toward FAR is
 * offered, Form A on a tie. Its summary says which form it is and why.
 */
import { unionAll } from '../geom';
import { FRONT_FACADE_MAX_M, frontAccess } from '../measure/front-access';
import type { FrontAccess } from '../measure/front-access';
import { m, m2 } from '../rules/format';
import type { Design, Problem, RegimeId, Site } from '../types';
import type { DesignSet } from './variants';
import { FIRE_ROAD_PROBLEM } from './variants';

/** Form B must give more than this much more floor area counted toward FAR to be chosen. */
const TIE_M2 = 1;
const MIN_DESIGNS = 2;
/** The design that names each regime's binding rule. */
const PRIMARY: Readonly<Record<RegimeId, string>> = { lowRise: 'low-rise-block', highRise: 'high-rise-max' };

/** Why a regime has no set-back set to compare with. */
export type SetBackStatus =
  | { readonly kind: 'generated' }
  | { readonly kind: 'atCap' }
  | { readonly kind: 'impossible' }
  | { readonly kind: 'smaller'; readonly grossM2: number };

type Measure = (d: Design) => FrontAccess;

function facing(fa: FrontAccess): string {
  return `${m(fa.facingM)} of a ${m(fa.perimeterM)} perimeter`;
}

/** What the other form would have done: a design to compare with, or the reason there is none. */
function otherText(other: Design | undefined, status: SetBackStatus, measure: Measure): string | null {
  if (other !== undefined) {
    const fa = measure(other);
    return fa.nearestM > FRONT_FACADE_MAX_M
      ? `setting it back behind a front open space would give ${m2(other.totals.farFloorAreaM2)}`
      : `a building on the road could face it with only ${facing(fa)} (clause 53 asks for more than an eighth), for ${m2(other.totals.farFloorAreaM2)}`;
  }
  switch (status.kind) {
    case 'atCap':
      return 'it already reaches the floor-area limit, so setting it back could not give more';
    case 'impossible':
      return 'setting it back more than 20 m behind a front open space does not fit here';
    case 'smaller':
      return `setting it back behind a front open space would give at most ${m2(status.grossM2)}`;
    case 'generated':
      return null;
  }
}

/** Which form the design takes, from its own geometry, and why. */
function formNote(d: Design, why: string | null, measure: Measure): string {
  const fa = measure(d);
  if (fa.nearestM > FRONT_FACADE_MAX_M) {
    return `Set back ${m(fa.nearestM)} from the road behind a front open space (clause 52(6))${why === null ? '' : `, because ${why}`}.`;
  }
  return `On the road, facing it with ${facing(fa)} (clause 53)${why === null ? '' : `; ${why}`}.`;
}

export interface FormInputs {
  readonly onRoad: DesignSet;
  /** The set-back set, or null when no regime has one. */
  readonly setBack: DesignSet | null;
  /** Per regime, whether a set-back set was generated and, if not, why. Null: forms do not apply. */
  readonly status: Readonly<Record<RegimeId, SetBackStatus>> | null;
  readonly site: Site;
}

/**
 * Merges the on-road set with the set-back set: per design id the one with more FAR area, Form A on
 * a tie, in the on-road order; a design only the set-back set has is added while fewer than two are
 * offered.
 */
export function chooseForms({ onRoad, setBack, status, site }: FormInputs): DesignSet {
  if (status === null) return onRoad;
  const measure: Measure = (d) => frontAccess(site, unionAll(d.floors.map((f) => f.outline)));
  const fromA = new Map(onRoad.designs.map((d) => [d.id, d] as const));
  const fromB = new Map((setBack?.designs ?? []).map((d) => [d.id, d] as const));
  const extra = [...fromB.keys()].filter((id) => !fromA.has(id));
  const ids = [...fromA.keys(), ...extra.slice(0, Math.max(0, MIN_DESIGNS - fromA.size))];
  const chosenB = new Set<string>();
  const designs = ids.map((id) => {
    const a = fromA.get(id);
    const b = fromB.get(id);
    const pickB = b !== undefined && (a === undefined || b.totals.farFloorAreaM2 > a.totals.farFloorAreaM2 + TIE_M2);
    const chosen = pickB ? b : a;
    if (chosen === undefined) throw new Error(`design ${id} in neither form`);
    if (pickB) chosenB.add(id);
    const st = status[chosen.regime];
    const why = otherText(pickB ? a : b, b === undefined && st.kind === 'generated' ? { kind: 'impossible' } : st, measure);
    return { ...chosen, summary: `${chosen.summary} ${formNote(chosen, why, measure)}` };
  });
  const stopOf = (r: RegimeId) => (chosenB.has(PRIMARY[r]) && setBack !== null ? setBack.stops[r] : onRoad.stops[r]);
  const hasHigh = designs.some((d) => d.regime === 'highRise');
  const problems: Problem[] = [...onRoad.problems, ...(setBack?.problems ?? [])].filter(
    (p, i, all) => all.findIndex((q) => q.message === p.message) === i && !(hasHigh && p.message === FIRE_ROAD_PROBLEM),
  );
  return { designs, stops: { lowRise: stopOf('lowRise'), highRise: stopOf('highRise') }, problems };
}

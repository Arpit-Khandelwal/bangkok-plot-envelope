import type { RoadFront } from '../context';
import type { AccessSpec, AccessTier } from '../data/spec';
import { m, m2 } from '../format';
import { describeRoad, FRONTAGE_ASSUMPTION, roadQualifies } from './routes';
import type { Resolver } from './types';

const UNCHECKED_NETWORK =
  'The road must also run on to another public road at least as wide; that is not checked here.';

function tierText(tier: AccessTier): string {
  return `at least ${m(tier.minFrontageM)} of frontage on a road at least ${m(tier.minRowM)} wide`;
}

interface Best {
  readonly tier: AccessTier;
  readonly road: RoadFront;
  readonly next: AccessTier | null;
}

function bestTier(spec: AccessSpec, roads: readonly RoadFront[]): Best | null {
  const found = spec.tiers.flatMap((tier, i): Best[] => {
    const road = roads.find((r) => roadQualifies(r, tier.minRowM, tier.minFrontageM));
    return road === undefined ? [] : [{ tier, road, next: spec.tiers[i + 1] ?? null }];
  });
  return found[found.length - 1] ?? null;
}

export const resolveAccess: Resolver<AccessSpec> = (spec, input) => {
  const roadsText = input.roads.map(describeRoad).join(' and ') || 'no road';
  const notes = `${FRONTAGE_ASSUMPTION} ${UNCHECKED_NETWORK}`;
  const best = bestTier(spec, input.roads);
  const first = spec.tiers[0];
  if (best === null || first === undefined) {
    return {
      requirement: `A high-rise or extra-large building is not possible on this plot: it needs ${first === undefined ? 'a qualifying road' : tierText(first)}.`,
      basis: `The plot has ${roadsText}. ${notes}`,
      effects: { blocks: true },
    };
  }
  const limit = best.tier.maxGfaM2;
  if (limit === null) {
    return {
      requirement: `Road access allows a high-rise of any size: the plot has ${describeRoad(best.road)}.`,
      basis: `It meets the widest access test, ${tierText(best.tier)}. ${notes}`,
      effects: {},
    };
  }
  const above = best.next === null ? '' : `; above that the plot needs ${tierText(best.next)}`;
  return {
    requirement: `Total floor area at most ${m2(limit)}${above}.`,
    basis: `The best road is ${describeRoad(best.road)}: it passes the test of ${tierText(best.tier)} but not the next one. ${notes}`,
    effects: {
      gfaLimits: [{ ruleId: spec.meta.id, limitM2: limit, measure: 'totalFloorArea', exclusive: false }],
    },
  };
};

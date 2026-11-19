import type { FarSpec } from '../data/spec';
import { m2, num } from '../format';
import type { Resolver } from './types';

const PARKING_COUNTS =
  'Parking floors count toward this total: the 2013 plan excludes nothing from floor area and exempts only extra public parking (setting: parking counts in FAR).';
const PARKING_EXCLUDED =
  'You have chosen to leave parking floors out of this total. The 2013 plan text excludes nothing, so this is not the conservative reading; the limit itself is unchanged.';

export const resolveFar: Resolver<FarSpec> = (spec, input) => {
  const area = input.site.areaM2;
  const limit = spec.ratio * area;
  return {
    requirement: `Total floor area at most ${m2(limit)}: ${num(spec.ratio)} times the plot area of ${m2(area)}, ${spec.source}.`,
    basis: [input.parkingCountsInFar ? PARKING_COUNTS : PARKING_EXCLUDED, ...(spec.note === undefined ? [] : [spec.note])].join(' '),
    effects: {
      gfaLimits: [{ ruleId: spec.meta.id, limitM2: limit, measure: 'totalFloorArea', exclusive: false }],
    },
  };
};

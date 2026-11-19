import type { RegimeThresholdSpec } from '../data/spec';
import { m, m2 } from '../format';
import type { Resolver } from './types';

export const resolveRegimeThreshold: Resolver<RegimeThresholdSpec> = (spec) => ({
  requirement: `Keep the roof deck below ${m(spec.roofDeckM)} and the total floor area below ${m2(spec.floorAreaM2)}, with no single floor of ${m2(spec.floorAreaM2)} or more; reaching either makes the building high-rise or extra-large.`,
  basis: `The ${m(spec.roofDeckM)} is measured from the ground to the roof-deck floor, so a parapet or lift overrun above it does not count here; the road height limit is still measured to the highest point.`,
  effects: {
    roofDeckCapM: spec.roofDeckM,
    gfaLimits: [
      { ruleId: spec.meta.id, limitM2: spec.floorAreaM2, measure: 'totalFloorArea', exclusive: true },
    ],
  },
});

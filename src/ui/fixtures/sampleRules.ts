import type { AppliedRule, RegimeId, RegimeRules } from '../../core/types';
import { CITE } from './fixtureParts';

const SHARED_RULES: readonly AppliedRule[] = [
  {
    id: 'plan.use-size',
    category: 'use',
    title: 'Condominium size limit',
    titleTh: 'อาคารอยู่อาศัยรวม',
    requirement: 'Over 10,000 m² only on a 30 m public road or within 500 m of a station platform',
    basis: 'Nearest station platform is 380 m away',
    citations: [CITE.planUseSize],
    disabled: false,
    binding: false,
  },
  {
    id: 'plan.far',
    category: 'density',
    title: 'Floor area ratio',
    titleTh: 'อัตราส่วนพื้นที่อาคารรวมต่อพื้นที่ดิน',
    requirement: 'Total floor area at most 12,500 m² (5 x plot area)',
    citations: [CITE.planFar],
    disabled: false,
    binding: false,
  },
  {
    id: 'plan.osr',
    category: 'openSpace',
    title: 'Open space ratio',
    titleTh: 'อัตราส่วนของที่ว่างต่อพื้นที่อาคารรวม',
    requirement: 'Open space at least 6% of total floor area',
    citations: [CITE.planOsr],
    disabled: false,
    binding: false,
  },
  {
    id: 'mr55.height-2x',
    category: 'height',
    title: 'Height limit from the road',
    requirement: 'Height at most 2 x the distance to the far side of the road',
    basis: 'Edge A faces a 12 m road',
    citations: [CITE.mr55Height],
    disabled: false,
    binding: false,
  },
  {
    id: 'bma.parking',
    category: 'parking',
    title: 'Parking',
    titleTh: 'ที่จอดรถ',
    requirement: 'One space per 120 m² of floor area, or per unit of 60 m² or more, whichever is greater',
    citations: [CITE.bmaParking],
    disabled: false,
    binding: false,
  },
];

const LOW_RISE_RULES: readonly AppliedRule[] = [
  {
    id: 'mr33.highrise-threshold',
    category: 'process',
    title: 'Stay under the high-rise threshold',
    titleTh: 'อาคารสูง',
    requirement: 'Roof deck under 23 m and total floor area under 10,000 m²',
    citations: [CITE.mr33Threshold],
    disabled: false,
    binding: true,
  },
  {
    id: 'mr55.road-setback',
    category: 'setback',
    title: 'Road setback',
    titleTh: 'แนวอาคาร',
    requirement: 'At least 1.2 m from the road boundary (one tenth of 12 m)',
    citations: [CITE.mr55Road],
    disabled: false,
    binding: false,
  },
  {
    id: 'bma.open-space-plot',
    category: 'openSpace',
    title: 'Open space on the plot',
    titleTh: 'ที่ว่าง',
    requirement: 'At least 750 m² open to the sky (30% of plot area)',
    citations: [CITE.bmaOpen],
    disabled: false,
    binding: false,
  },
];

const HIGH_RISE_RULES: readonly AppliedRule[] = [
  {
    id: 'mr33.boundary-6m',
    category: 'setback',
    title: 'High-rise boundary setback',
    requirement: 'At least 6 m from every boundary and road, for the whole building',
    citations: [CITE.mr33Boundary],
    disabled: false,
    binding: false,
  },
  {
    id: 'mr33.access-road',
    category: 'access',
    title: 'Road access for a high-rise',
    requirement: 'A plot side of at least 12 m on a road at least 10 m wide',
    citations: [CITE.mr33Access],
    disabled: false,
    binding: false,
  },
  {
    id: 'bma.open-space-plot',
    category: 'openSpace',
    title: 'Open space on the plot',
    titleTh: 'ที่ว่าง',
    requirement: 'At least 750 m² open to the sky (30% of plot area)',
    citations: [CITE.bmaOpen, CITE.mr33Boundary],
    disabled: false,
    binding: false,
  },
];

function withBinding(rules: readonly AppliedRule[], bindingId: string): AppliedRule[] {
  return rules.map((rule) => ({ ...rule, binding: rule.id === bindingId }));
}

const BASE_REGIME = {
  available: true,
  blockedBy: [],
  heightPlanes: [{ edgeIndex: 0, rowWidthM: 12, slope: 2, ruleId: 'mr55.height-2x' }],
  openSpace: [{ ruleId: 'bma.open-space-plot', basis: 'plotArea', share: 0.3 }],
  parking: { m2PerStall: 120, stallsPerLargeUnit: 1, ruleId: 'bma.parking' },
  minFloorToFloorM: 2.6,
} as const;

export function sampleRegimeRules(regime: RegimeId): RegimeRules {
  if (regime === 'lowRise') {
    return {
      ...BASE_REGIME,
      regime,
      setbacks: [{ edgeIndex: 0, distanceM: 1.2, ruleId: 'mr55.road-setback' }],
      roofDeckCapM: 23,
      roofDeckCapRuleId: 'mr33.highrise-threshold',
      gfaLimits: [
        { ruleId: 'plan.far', limitM2: 12500, measure: 'totalFloorArea', exclusive: false },
        { ruleId: 'mr33.highrise-threshold', limitM2: 10000, measure: 'totalFloorArea', exclusive: true },
      ],
      maxGfaM2: 10000,
      bindingGfaRuleId: 'mr33.highrise-threshold',
      maxMainUseM2: null,
      bindingMainUseRuleId: null,
      rules: withBinding([...SHARED_RULES, ...LOW_RISE_RULES], 'mr33.highrise-threshold'),
    };
  }
  return {
    ...BASE_REGIME,
    regime,
    setbacks: [0, 1, 2, 3].map((edgeIndex) => ({ edgeIndex, distanceM: 6, ruleId: 'mr33.boundary-6m' })),
    roofDeckCapM: null,
    roofDeckCapRuleId: null,
    gfaLimits: [{ ruleId: 'plan.far', limitM2: 12500, measure: 'totalFloorArea', exclusive: false }],
    maxGfaM2: 12500,
    bindingGfaRuleId: 'plan.far',
    maxMainUseM2: null,
    bindingMainUseRuleId: null,
    rules: withBinding([...SHARED_RULES, ...HIGH_RISE_RULES], 'plan.far'),
  };
}

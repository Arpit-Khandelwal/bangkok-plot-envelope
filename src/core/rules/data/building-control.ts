/**
 * Building-control rules that do not depend on the zone: MR 55, MR 33, the Bangkok ordinance
 * B.E. 2544 and MR 7. Sources: research/01-regulations.md §2.6, §3, §4, §5 and
 * research/05-office-hotel-rules.md §3.
 *
 * Order matters in one place: when two setback rules demand the same distance on an edge,
 * the one listed first is named, so the specific rules (road, waterway) come before the
 * general ones.
 */
import type { BuildingType } from '../../types';
import { cite } from './sources';
import type { RuleMeta, RuleSpec } from './spec';

const HIGH_RISE_SETBACK_M = 6;
const LARGE_UNIT_M2 = 60;

/** BMA ข้อ 52 open space on the plot, cited with MR 33 ข้อ 6 in the high-rise regime. */
function plotOpenSpace(
  type: BuildingType,
  share: number,
  bmaClause: string,
  mr33Clause: string,
): readonly RuleSpec[] {
  const meta = (withMr33: boolean): RuleMeta => ({
    id: 'bma.open-space-plot',
    category: 'openSpace',
    title: 'Open space on the plot',
    titleTh: 'ที่ว่าง',
    citations: [
      cite('BMA2544', bmaClause, 'verified'),
      ...(withMr33 ? [cite('MR33', mr33Clause, 'verified')] : []),
    ],
  });
  return [
    { kind: 'openSpace', regimes: ['lowRise'], buildingTypes: [type], basis: 'plotArea', share, meta: meta(false) },
    { kind: 'openSpace', regimes: ['highRise'], buildingTypes: [type], basis: 'plotArea', share, meta: meta(true) },
  ];
}

export const BUILDING_CONTROL_RULES: readonly RuleSpec[] = [
  {
    kind: 'regimeThreshold',
    regimes: ['lowRise'],
    roofDeckM: 23,
    floorAreaM2: 10_000,
    meta: {
      id: 'mr33.highrise-threshold',
      category: 'height',
      title: 'High-rise and extra-large thresholds',
      titleTh: 'อาคารสูง',
      citations: [cite('MR33', 'ข้อ 1', 'verified')],
    },
  },
  {
    kind: 'far',
    regimes: ['highRise'],
    ratio: 10,
    source: 'for any plot with a high-rise or extra-large building',
    meta: {
      id: 'mr33.far-10',
      category: 'density',
      title: 'High-rise floor area ratio cap',
      citations: [cite('MR33', 'ข้อ 5', 'verified')],
    },
  },
  {
    kind: 'heightPlane',
    slope: 2,
    meta: {
      id: 'mr55.height-2x',
      category: 'height',
      title: 'Height limit from the road width',
      citations: [
        cite('MR55', 'ข้อ 44', 'verified'),
        cite('MR55', 'ข้อ 45', 'verified'),
        cite('MR55', 'ข้อ 46', 'verified'),
        cite('BMA2544', 'ข้อ 49', 'verified'),
      ],
    },
  },
  {
    kind: 'roadSetback',
    bands: [
      { untilRowM: 10, includesUntil: false, rule: { kind: 'fromCentreline', distanceM: 6 } },
      { untilRowM: 20, includesUntil: true, rule: { kind: 'shareOfRow', share: 0.1 } },
      { untilRowM: null, includesUntil: false, rule: { kind: 'fromBoundary', distanceM: 2 } },
    ],
    meta: {
      id: 'mr55.road-setback',
      category: 'setback',
      title: 'Building line from the road',
      titleTh: 'แนวอาคาร',
      citations: [cite('MR55', 'ข้อ 41', 'verified'), cite('BMA2544', 'ข้อ 50', 'verified')],
    },
  },
  {
    kind: 'waterwaySetback',
    bands: [
      { belowWidthM: 10, distanceM: 3 },
      { belowWidthM: null, distanceM: 6 },
    ],
    meta: {
      id: 'mr55.waterway',
      category: 'setback',
      title: 'Setback from a public waterway',
      citations: [cite('MR55', 'ข้อ 42', 'verified')],
    },
  },
  {
    kind: 'uniformSetback',
    regimes: ['highRise'],
    distanceM: HIGH_RISE_SETBACK_M,
    appliesTo: ['road', 'neighbour', 'waterway'],
    what: 'every part of the building above or below ground, except foundations,',
    assumption:
      'Read as covering the whole building, podium and basement included, since the text speaks of the outermost edge of the high-rise building.',
    meta: {
      id: 'mr33.boundary-6m',
      category: 'setback',
      title: 'High-rise clearance from every boundary',
      citations: [cite('MR33', 'ข้อ 4', 'verified')],
    },
  },
  {
    kind: 'uniformSetback',
    distanceM: 3,
    appliesTo: ['neighbour'],
    what: 'walls with windows, doors, vents or balconies',
    assumption:
      'Assumes walls with openings on all sides and a building taller than 9 m; a blank wall could come closer.',
    meta: {
      id: 'mr55.boundary-openings',
      category: 'setback',
      title: 'Side and rear setback for walls with openings',
      citations: [cite('MR55', 'ข้อ 50(2)', 'verified'), cite('BMA2544', 'ข้อ 54', 'verified')],
    },
  },
  {
    kind: 'uniformSetback',
    distanceM: 2,
    appliesTo: ['road', 'neighbour', 'waterway'],
    what: 'the building',
    assumption:
      'The clear space runs all around the building. 2 m applies above 15 m, which a building in either regime may reach (1 m at or below 15 m).',
    meta: {
      id: 'bma.clear-space',
      category: 'setback',
      title: 'Clear space around the building',
      citations: [cite('BMA2544', 'ข้อ 55', 'verified')],
    },
  },
  // MR 33 ข้อ 6 repeats the same share for high-rise and extra-large buildings only.
  ...plotOpenSpace('condo', 0.3, 'ข้อ 52(1)', 'ข้อ 6(1)'),
  ...plotOpenSpace('office', 0.1, 'ข้อ 52(2)', 'ข้อ 6(2)'),
  {
    kind: 'openSpace',
    buildingTypes: ['condo'],
    basis: 'largestFloor',
    share: 0.3,
    meta: {
      id: 'mr55.open-space-floor',
      category: 'openSpace',
      title: 'Open space against the largest floor',
      titleTh: 'ที่ว่าง',
      citations: [cite('MR55', 'ข้อ 33(1)', 'verified')],
    },
  },
  {
    kind: 'openSpace',
    buildingTypes: ['office'],
    basis: 'largestFloor',
    share: 0.1,
    meta: {
      id: 'mr55.open-space-floor',
      category: 'openSpace',
      title: 'Open space against the largest floor',
      titleTh: 'ที่ว่าง',
      citations: [cite('MR55', 'ข้อ 33(2)', 'verified')],
    },
  },
  {
    kind: 'access',
    regimes: ['highRise'],
    tiers: [
      { minRowM: 10, minFrontageM: 12, maxGfaM2: 30_000 },
      { minRowM: 18, minFrontageM: 12, maxGfaM2: null },
    ],
    meta: {
      id: 'mr33.access-road',
      category: 'access',
      title: 'Road access for a high-rise or extra-large building',
      citations: [cite('MR33', 'ข้อ 2', 'verified')],
    },
  },
  {
    kind: 'info',
    regimes: ['highRise'],
    requirement:
      'Leave a fire-truck road at least 6 m wide, open to the sky, all around the building, and keep a 12 m wide open strip from the road frontage to the building.',
    basis: 'This road can lie inside the setback strips, so it does not shrink the envelope here; check it in the site plan.',
    meta: {
      id: 'mr33.fire-road',
      category: 'access',
      title: 'Fire-truck access around a high-rise',
      citations: [cite('MR33', 'ข้อ 2', 'verified'), cite('MR33', 'ข้อ 3', 'verified')],
    },
  },
  {
    kind: 'parking',
    buildingTypes: ['condo'],
    m2PerStall: 120,
    stallsPerLargeUnit: 1,
    largeUnitM2: LARGE_UNIT_M2,
    note: 'Fractions round up. Whether the floor-area count includes the parking floors themselves is unsettled; counting only the other floors is the usual practice.',
    meta: {
      id: 'bma.parking',
      category: 'parking',
      title: 'Car parking',
      titleTh: 'ที่จอดรถ',
      citations: [
        cite('BMA2544', 'ข้อ 84(3)', 'verified'),
        cite('BMA2544', 'ข้อ 84(16)', 'verified'),
        cite('MR7', 'ข้อ 3(1)', 'verified'),
      ],
    },
  },
  {
    kind: 'parking',
    buildingTypes: ['office'],
    m2PerStall: 60,
    stallsPerLargeUnit: 0,
    largeUnitM2: LARGE_UNIT_M2,
    note: 'Fractions round up. The large-building rate of one space per 120 m² never governs a pure office, because one per 60 m² always gives more.',
    meta: {
      id: 'bma.parking',
      category: 'parking',
      title: 'Car parking',
      titleTh: 'ที่จอดรถ',
      citations: [cite('BMA2544', 'ข้อ 84(6)', 'verified'), cite('MR7', 'ข้อ 3(1)(ฉ)', 'verified')],
    },
  },
  {
    kind: 'floorHeight',
    buildingTypes: ['condo'],
    minFloorToFloorM: 2.6,
    roomLabel: 'dwelling rooms and corridors',
    meta: {
      id: 'mr55.floor-height',
      category: 'height',
      title: 'Minimum floor-to-floor height',
      titleTh: 'ระยะดิ่ง',
      citations: [cite('MR55', 'ข้อ 22', 'verified')],
    },
  },
  {
    kind: 'floorHeight',
    buildingTypes: ['office'],
    minFloorToFloorM: 3,
    roomLabel: 'office rooms',
    meta: {
      id: 'mr55.floor-height',
      category: 'height',
      title: 'Minimum floor-to-floor height',
      titleTh: 'ระยะดิ่ง',
      citations: [cite('MR55', 'ข้อ 22', 'verified')],
    },
  },
  {
    kind: 'info',
    buildingTypes: ['condo'],
    requirement:
      'An environmental impact assessment is needed if the condo has 80 units or more, or 4,000 m² or more of usable area. It does not change the envelope but adds roughly a year to approval.',
    basis:
      'Threshold taken from the environment agency’s own guidance; the table in the ministry announcement of B.E. 2566 could not be read.',
    meta: {
      id: 'eia.threshold',
      category: 'process',
      title: 'Environmental impact assessment',
      citations: [cite('EIA', 'อาคารชุด / อาคารอยู่อาศัยรวม', 'corroborated')],
    },
  },
];

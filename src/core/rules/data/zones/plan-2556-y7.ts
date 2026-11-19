/**
 * Zone ย.7, Bangkok Comprehensive Plan B.E. 2556, clause 14.
 * Sources: research/01-regulations.md §2.2-2.4, research/05-office-hotel-rules.md §1.
 * Another zone of the same family (e.g. ย.6, clause 13: FAR 4.5, OSR 6.5%) is a copy of this
 * file with its own clause numbers and values, registered in ./index.ts.
 */
import { cite } from '../sources';
import type { ZoneData } from '../spec';

const CLAUSE = 'ข้อ 14';
const STATION_MAX_DISTANCE_M = 500;

export const ZONE_2556_Y7: ZoneData = {
  code: 'ย.7',
  planVersion: '2556',
  buildingTypes: ['condo', 'office'],
  rules: [
    {
      kind: 'far',
      ratio: 5,
      source: 'under the zone plan',
      note: 'No floor-area bonus (clauses 52 to 57) is included.',
      meta: {
        id: 'plan.far',
        category: 'density',
        title: 'Floor area ratio',
        titleTh: 'อัตราส่วนพื้นที่อาคารรวมต่อพื้นที่ดิน',
        citations: [cite('Plan2556', `${CLAUSE}(1)`, 'verified')],
      },
    },
    {
      kind: 'useSize',
      buildingTypes: ['condo'],
      measure: 'totalFloorArea',
      measureLabel: 'total floor area',
      useLabel: 'a condominium',
      note: 'Counted over all buildings on the plot, not per building: the 2013 text has no per-building wording (DECISIONS B3).',
      tiers: [
        { upToM2: 10_000, anyOf: [] },
        {
          upToM2: null,
          anyOf: [
            { kind: 'road', minRowM: 30, minFrontageM: 30 },
            { kind: 'station', maxDistanceM: STATION_MAX_DISTANCE_M },
          ],
        },
      ],
      meta: {
        id: 'plan.use-size',
        category: 'use',
        title: 'Condominium size limit',
        titleTh: 'อาคารอยู่อาศัยรวม',
        citations: [
          cite('Plan2556', `${CLAUSE}(11)`, 'verified'),
          // Frontage reading of clause 36(4) is ours (DECISIONS B4).
          cite('Plan2556', 'ข้อ 36(4)', 'assumption'),
          cite('Plan2556', 'ข้อ 37', 'verified'),
        ],
      },
    },
    {
      kind: 'useSize',
      buildingTypes: ['office'],
      measure: 'mainUseFloorArea',
      measureLabel: 'operating area',
      useLabel: 'an office',
      note: 'The limit counts operating area, not total floor area: the office floors plus areas in continuing use by the business, which may take in its own parking and lobby.',
      tiers: [
        { upToM2: 1_000, anyOf: [] },
        {
          upToM2: 10_000,
          anyOf: [
            { kind: 'road', minRowM: 16, minFrontageM: 16 },
            { kind: 'station', maxDistanceM: STATION_MAX_DISTANCE_M },
          ],
        },
      ],
      meta: {
        id: 'plan.use-size',
        category: 'use',
        title: 'Office size limit',
        titleTh: 'สำนักงานที่มีพื้นที่ประกอบการ',
        citations: [
          cite('Plan2556', `${CLAUSE}(13)`, 'verified'),
          cite('Plan2556', 'ข้อ 36(3)', 'assumption'),
          cite('Plan2556', 'ข้อ 37', 'verified'),
        ],
      },
    },
    {
      kind: 'openSpace',
      basis: 'totalFloorArea',
      share: 0.06,
      meta: {
        id: 'plan.osr',
        category: 'openSpace',
        title: 'Open space ratio',
        titleTh: 'อัตราส่วนของที่ว่างต่อพื้นที่อาคารรวม',
        citations: [cite('Plan2556', `${CLAUSE}(2)`, 'verified')],
      },
    },
    {
      kind: 'info',
      requirement:
        'At least half of the open space must be permeable ground for planting, not paving.',
      basis:
        'Whether the half is taken of the plan open-space ratio alone or of the larger building-control minimum is unresolved; the larger figure is the safe reading.',
      meta: {
        id: 'plan.permeable',
        category: 'openSpace',
        title: 'Permeable planting area',
        titleTh: 'พื้นที่น้ำซึมผ่านได้',
        citations: [cite('Plan2556', `${CLAUSE}(2)`, 'verified')],
      },
    },
  ],
};

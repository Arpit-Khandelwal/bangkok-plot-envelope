import type { Check, Design, EdgeInfo, Floor, SectionFloor, Site } from '../../core/types';
import type { OkEvaluation } from '../model/buildModel';
import { CITE, boxMesh, squareRegion, stackFloors } from './fixtureParts';
import { sampleRegimeRules } from './sampleRules';

/**
 * A hand-written evaluation for a 50 x 50 m condo plot on a 12 m road, 380 m from a station.
 * Two designs: a low-rise block that passes, and a tower that breaks the 2:1 height limit.
 * Floor areas are whole numbers so every total is an exact sum.
 */

const HALF = 25;
const RING = [
  { x: -HALF, y: -HALF },
  { x: HALF, y: -HALF },
  { x: HALF, y: HALF },
  { x: -HALF, y: HALF },
];

const EDGES: EdgeInfo[] = RING.map((from, index) => ({
  index,
  sourceIndex: index,
  spec: index === 0 ? { kind: 'road', roadId: 'road-1', rowWidthM: 12 } : { kind: 'neighbour' },
  lengthM: 50,
  from,
  to: RING[(index + 1) % RING.length] ?? from,
}));

const SITE: Site = {
  frame: { origin: [100.609, 13.6893] },
  ring: RING,
  areaM2: 2500,
  perimeterM: 200,
  edges: EDGES,
};

function sum(floors: readonly Floor[], pick: (floor: Floor) => boolean): number {
  return floors.filter(pick).reduce((total, floor) => total + floor.areaM2, 0);
}

function sectionFloors(floors: readonly Floor[], nearM: number, farFor: (floor: Floor) => number): SectionFloor[] {
  return floors.map((floor) => ({
    level: floor.level,
    use: floor.use,
    baseM: floor.baseM,
    topM: floor.topM,
    nearM,
    farM: farFor(floor),
  }));
}

const LOW_FLOORS = stackFloors([
  { use: 'parking', count: 2, floorToFloorM: 3, areaM2: 1350 },
  { use: 'residential', count: 5, floorToFloorM: 3.1, areaM2: 1350 },
]);

const LOW_CHECKS: Check[] = [
  { ruleId: 'plan.far', title: 'Floor area ratio', status: 'pass', required: 'At most 12,500 m²', actual: '9,450 m²', citations: [CITE.planFar] },
  { ruleId: 'mr33.highrise-threshold', title: 'Stay under the high-rise threshold', status: 'pass', required: 'Roof deck under 23 m, floor area under 10,000 m²', actual: 'Roof deck 21.5 m, 9,450 m²', citations: [CITE.mr33Threshold] },
  { ruleId: 'mr55.height-2x', title: 'Height limit from the road', status: 'pass', required: 'At most 30 m at the front face', actual: '22.7 m', citations: [CITE.mr55Height] },
  { ruleId: 'bma.open-space-plot', title: 'Open space on the plot', status: 'pass', required: 'At least 750 m²', actual: '1,150 m²', citations: [CITE.bmaOpen] },
  { ruleId: 'bma.parking', title: 'Parking', status: 'pass', required: 'At least 79 spaces', actual: '96 spaces', citations: [CITE.bmaParking] },
  { ruleId: 'eia.threshold', title: 'Environmental impact assessment', status: 'info', required: 'Needed at 80 units or more', actual: '135 units', citations: [] },
];

const LOW_RISE: Design = {
  id: 'low-rise-block',
  name: 'Low-rise block',
  summary: 'Seven storeys kept under 23 m and 10,000 m², so the lighter rules apply.',
  regime: 'lowRise',
  floors: LOW_FLOORS,
  totals: {
    grossFloorAreaM2: 9450,
    farFloorAreaM2: 9450,
    far: 3.78,
    parkingFloorAreaM2: sum(LOW_FLOORS, (floor) => floor.use === 'parking'),
    mainUseFloorAreaM2: sum(LOW_FLOORS, (floor) => floor.use !== 'parking'),
    sellableAreaM2: 4725,
    coverageM2: 1350,
    openSpaceM2: 1150,
    storeys: 7,
    roofDeckHeightM: 21.5,
    topHeightM: 22.7,
    units: 135,
    parkingRequired: 79,
    parkingProvided: 96,
    allowedFar: 5,
    envelopeVolumeShare: 0.58,
  },
  checks: LOW_CHECKS,
  passes: true,
  massing: [
    { use: 'parking', mesh: boxMesh(-22, -18, 0, 22, 12.7, 6) },
    { use: 'residential', mesh: boxMesh(-22, -18, 6, 22, 12.7, 21.5) },
  ],
  section: {
    roadEdgeIndex: 0,
    rowWidthM: 12,
    setbackM: 1.2,
    plotDepthM: 50,
    slope: 2,
    roofDeckCapM: 23,
    floors: sectionFloors(LOW_FLOORS, 3, () => 33.7),
  },
};

const TOWER_FLOORS = stackFloors([
  { use: 'parking', count: 3, floorToFloorM: 3, areaM2: 1400 },
  { use: 'residential', count: 9, floorToFloorM: 3.1, areaM2: 900 },
]);

const TOWER_CHECKS: Check[] = [
  { ruleId: 'plan.far', title: 'Floor area ratio', status: 'pass', required: 'At most 12,500 m²', actual: '12,300 m²', citations: [CITE.planFar] },
  { ruleId: 'plan.use-size', title: 'Condominium size limit', status: 'warn', required: 'Within 500 m of a station platform', actual: '380 m, measured to an approximate platform outline', citations: [CITE.planUseSize] },
  { ruleId: 'mr55.height-2x', title: 'Height limit from the road', status: 'fail', required: 'At most 36 m at the front face', actual: '38.1 m', citations: [CITE.mr55Height] },
  { ruleId: 'mr33.boundary-6m', title: 'High-rise boundary setback', status: 'pass', required: 'At least 6 m', actual: '6 m', citations: [CITE.mr33Boundary] },
  { ruleId: 'mr33.access-road', title: 'Road access for a high-rise', status: 'pass', required: '12 m frontage on a road at least 10 m wide', actual: '50 m on a 12 m road', citations: [CITE.mr33Access] },
  { ruleId: 'bma.parking', title: 'Parking', status: 'pass', required: 'At least 103 spaces', actual: '150 spaces', citations: [CITE.bmaParking] },
];

const TOWER: Design = {
  id: 'tower-on-podium',
  name: 'Tower on podium',
  summary: 'A twelve-storey tower on a parking podium, using the full floor area ratio.',
  regime: 'highRise',
  floors: TOWER_FLOORS,
  totals: {
    grossFloorAreaM2: 12300,
    farFloorAreaM2: 12300,
    far: 4.92,
    parkingFloorAreaM2: sum(TOWER_FLOORS, (floor) => floor.use === 'parking'),
    mainUseFloorAreaM2: sum(TOWER_FLOORS, (floor) => floor.use !== 'parking'),
    sellableAreaM2: 5670,
    coverageM2: 1400,
    openSpaceM2: 1100,
    storeys: 12,
    roofDeckHeightM: 36.9,
    topHeightM: 38.1,
    units: 162,
    parkingRequired: 103,
    parkingProvided: 150,
    allowedFar: 5,
    envelopeVolumeShare: 0.55,
  },
  checks: TOWER_CHECKS,
  passes: false,
  massing: [
    { use: 'parking', mesh: boxMesh(-19, -19, 0, 19, 17.8, 9) },
    { use: 'residential', mesh: boxMesh(-15, -19, 9, 15, 11, 36.9) },
  ],
  section: {
    roadEdgeIndex: 0,
    rowWidthM: 12,
    setbackM: 6,
    plotDepthM: 50,
    slope: 2,
    roofDeckCapM: null,
    floors: sectionFloors(TOWER_FLOORS, 6, (floor) => (floor.use === 'parking' ? 42.8 : 36)),
  },
};

export const sampleEvaluation: OkEvaluation = {
  ok: true,
  site: SITE,
  problems: [],
  hypothetical: false,
  nonDefaultReadings: [],
  regimes: {
    lowRise: {
      rules: sampleRegimeRules('lowRise'),
      envelope: { footprint: squareRegion(23.8, 23), footprintAreaM2: 2189, maxHeightM: 23, volumeM3: 50347, mesh: boxMesh(-23.8, -23.8, 0, 23.8, 23, 23) },
    },
    highRise: {
      rules: sampleRegimeRules('highRise'),
      envelope: { footprint: squareRegion(19, 19), footprintAreaM2: 1444, maxHeightM: 60, volumeM3: 70000, mesh: boxMesh(-19, -19, 0, 19, 19, 60) },
    },
  },
  designs: [LOW_RISE, TOWER],
};

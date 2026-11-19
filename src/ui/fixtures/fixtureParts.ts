import type { Citation, Floor, FloorUse, Mesh, Region } from '../../core/types';

/** Builders for the hand-written test evaluation. Small on purpose: the UI only needs shapes. */

const BOX_TRIANGLES = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];

/** A closed box from (x0, y0, z0) to (x1, y1, z1), in local metres. */
export function boxMesh(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Mesh {
  const corners = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  return { positions: new Float32Array(corners.flat()), indices: new Uint32Array(BOX_TRIANGLES) };
}

export function squareRegion(halfWidth: number, halfDepth: number): Region {
  return [
    {
      outer: [
        { x: -halfWidth, y: -halfDepth },
        { x: halfWidth, y: -halfDepth },
        { x: halfWidth, y: halfDepth },
        { x: -halfWidth, y: halfDepth },
      ],
      holes: [],
    },
  ];
}

export interface FloorRun {
  readonly use: FloorUse;
  readonly count: number;
  readonly floorToFloorM: number;
  readonly areaM2: number;
}

/** Stacks runs of identical floors from the ground up. */
export function stackFloors(runs: readonly FloorRun[]): Floor[] {
  const floors: Floor[] = [];
  let baseM = 0;
  runs.forEach((run) => {
    for (let index = 0; index < run.count; index += 1) {
      const topM = Math.round((baseM + run.floorToFloorM) * 100) / 100;
      const side = Math.sqrt(run.areaM2) / 2;
      floors.push({
        level: floors.length + 1,
        use: run.use,
        baseM,
        topM,
        outline: squareRegion(side, side),
        areaM2: run.areaM2,
      });
      baseM = topM;
    }
  });
  return floors;
}

const PLAN_URL = 'https://download.asa.or.th/03media/04law/cpa/mr56-bma.pdf';
const MR55_URL = 'https://download.asa.or.th/03media/04law/fubr/a1_bcmr55-63.pdf';
const MR33_URL = 'https://download.asa.or.th/03media/04law/fubr/a3_bcmr33-64.pdf';
const BMA_URL = 'https://download.asa.or.th/03media/04law/cba/bb/bb44-03.pdf';

export const CITE = {
  planFar: { document: 'Bangkok Comprehensive Plan B.E. 2556', clause: 'ข้อ 14(1)', url: PLAN_URL, confidence: 'verified' },
  planOsr: { document: 'Bangkok Comprehensive Plan B.E. 2556', clause: 'ข้อ 14(2)', url: PLAN_URL, confidence: 'verified' },
  planUseSize: { document: 'Bangkok Comprehensive Plan B.E. 2556', clause: 'ข้อ 14(11)', url: PLAN_URL, confidence: 'verified' },
  mr33Threshold: { document: 'Ministerial Regulation No. 33 B.E. 2535', clause: 'ข้อ 1', url: MR33_URL, confidence: 'verified' },
  mr33Access: { document: 'Ministerial Regulation No. 33 B.E. 2535', clause: 'ข้อ 2', url: MR33_URL, confidence: 'verified' },
  mr33Boundary: { document: 'Ministerial Regulation No. 33 B.E. 2535', clause: 'ข้อ 4', url: MR33_URL, confidence: 'verified' },
  mr55Height: { document: 'Ministerial Regulation No. 55 B.E. 2543', clause: 'ข้อ 44', url: MR55_URL, confidence: 'verified' },
  mr55Road: { document: 'Ministerial Regulation No. 55 B.E. 2543', clause: 'ข้อ 41', url: MR55_URL, confidence: 'verified' },
  bmaOpen: { document: 'Bangkok Building Control Ordinance B.E. 2544', clause: 'ข้อ 52', url: BMA_URL, confidence: 'corroborated' },
  bmaParking: { document: 'Bangkok Building Control Ordinance B.E. 2544', clause: 'ข้อ 83', url: BMA_URL, confidence: 'verified' },
} as const satisfies Record<string, Citation>;

import type { HeightPlane } from '../../types';
import type { RoadFront } from '../context';
import type { HeightPlaneSpec } from '../data/spec';
import { edgeList, m, num } from '../format';
import type { Resolver } from './types';

/** The widest road or roads; on a tie every road of that width governs (the stricter reading). */
export function governingRoads(roads: readonly RoadFront[]): readonly RoadFront[] {
  if (roads.length === 0) return [];
  const widest = Math.max(...roads.map((r) => r.rowWidthM));
  return roads.filter((r) => r.rowWidthM === widest);
}

const MEASURE_NOTE =
  'Height is measured from road level to the highest point of the building, parapet included; rooftop structures that are themselves separate structures, such as water tanks, are not counted.';

function bindingNote(parapetM: number): string {
  return `It is marked as shaping the envelope when, at the building line, it is lower than any roof-deck cap plus the assumed ${m(parapetM)} parapet.`;
}

function cornerNote(roads: readonly RoadFront[], governing: readonly RoadFront[]): string {
  if (roads.length <= 1) return '';
  if (governing.length > 1) {
    return 'The roads are equally wide, so each one governs along its own edges. ';
  }
  const widest = governing[0];
  const width = widest === undefined ? '' : ` (${m(widest.rowWidthM)})`;
  return `The plot has more than one road, so the wider road${width} governs (corner and parallel-road rules); the 60 m building-length limits of those rules are not checked. `;
}

export const resolveHeightPlane: Resolver<HeightPlaneSpec> = (spec, input) => {
  const governing = governingRoads(input.roads);
  const planes: HeightPlane[] = governing.flatMap((road) =>
    road.edgeIndices.map((edgeIndex) => ({
      edgeIndex,
      rowWidthM: road.rowWidthM,
      slope: spec.slope,
      ruleId: spec.meta.id,
    })),
  );
  if (governing.length === 0) {
    return { requirement: 'No road edge, so no road height limit can be set.', effects: {} };
  }
  const requirement = governing
    .map(
      (road) =>
        `Building height at any point at most ${num(spec.slope)} times its distance to the far side of the ${m(road.rowWidthM)} road: ${m(spec.slope * road.rowWidthM)} at the plot edge (${edgeList(input.site, road.edgeIndices)}), rising ${m(spec.slope)} for every metre further back.`,
    )
    .join(' ');
  return {
    requirement,
    basis: `${cornerNote(input.roads, governing)}${MEASURE_NOTE} ${bindingNote(input.parapetM)}`,
    effects: { heightPlanes: planes },
  };
};

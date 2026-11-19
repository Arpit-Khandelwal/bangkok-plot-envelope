import type { Site } from '../../types';
import type { RoadFront } from '../context';
import type { HeightPlaneSpec } from '../data/spec';
import { edgeList, m, num } from '../format';
import { heightRoads } from '../height-roads';
import type { Resolver } from './types';

const MEASURE_NOTE =
  'Height is measured from road level to the highest point of the building, parapet included; rooftop structures that are themselves separate structures, such as water tanks, are not counted.';

const EXCEPTION_NOTE =
  'The wider-road exceptions are judged on the plot as a whole, so that they hold for any building on it.';

function bindingNote(parapetM: number): string {
  return `It is marked as shaping the envelope when, at the building line, it is lower than any roof-deck cap plus the assumed ${m(parapetM)} parapet.`;
}

function roadSentence(slope: number, road: RoadFront, edges: readonly number[], site: Site): string {
  return `Building height at any point at most ${num(slope)} times its distance to the far side of the ${m(road.rowWidthM)} road: ${m(slope * road.rowWidthM)} at the plot edge (${edgeList(site, edges)}), rising ${m(slope)} for every metre further back.`;
}

export const resolveHeightPlane: Resolver<HeightPlaneSpec> = (spec, input) => {
  if (input.roads.length === 0) {
    return { requirement: 'No road edge, so no road height limit can be set.', effects: {} };
  }
  const chosen = heightRoads(input.site, spec.slope, spec.meta.id);
  const sentences = input.roads.flatMap((road) => {
    const edges = chosen.planes.filter((p) => road.edgeIndices.includes(p.edgeIndex)).map((p) => p.edgeIndex);
    return edges.length === 0 ? [] : [roadSentence(spec.slope, road, edges, input.site)];
  });
  const lead = sentences.length > 1 ? 'Each road limits height and the lowest limit governs at every point. ' : '';
  const exceptions = input.roads.length > 1 ? `${EXCEPTION_NOTE} ` : '';
  const notes = chosen.notes.length === 0 ? '' : `${chosen.notes.join(' ')} `;
  return {
    requirement: `${lead}${sentences.join(' ')}`,
    basis: `${notes}${exceptions}${MEASURE_NOTE} ${bindingNote(input.parapetM)}`,
    effects: { heightPlanes: chosen.planes },
  };
};

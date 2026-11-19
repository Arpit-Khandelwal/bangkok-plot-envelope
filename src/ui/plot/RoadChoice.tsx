import { useId } from 'react';
import type { EdgeSpec } from '../../core/types';
import { edgeLetter } from '../../map/edgeLabels';
import { isRoad, newRoadId } from './edgeChoices';

const NEW_ROAD = '__new';

export interface RoadChoiceProps {
  readonly index: number;
  readonly edges: readonly EdgeSpec[];
  readonly onChange: (spec: EdgeSpec) => void;
}

interface RoadOption {
  readonly roadId: string;
  readonly widthM: number;
  readonly letters: string;
}

/** Other roads on this plot, each named by the edges that face it. */
function otherRoads(index: number, edges: readonly EdgeSpec[]): RoadOption[] {
  const byRoad = new Map<string, { widthM: number; letters: string[] }>();
  edges.forEach((spec, edgeIndex) => {
    if (!isRoad(spec) || edgeIndex === index) return;
    const entry = byRoad.get(spec.roadId) ?? { widthM: spec.rowWidthM, letters: [] };
    byRoad.set(spec.roadId, { widthM: entry.widthM, letters: [...entry.letters, edgeLetter(edgeIndex)] });
  });
  return [...byRoad.entries()].map(([roadId, entry]) => ({ roadId, widthM: entry.widthM, letters: entry.letters.join(', ') }));
}

/** "Same road as edge X / A different road". Shown only when more than one edge is a road. */
export function RoadChoice({ index, edges, onChange }: RoadChoiceProps) {
  const selectId = useId();
  const spec = edges[index];
  if (!isRoad(spec)) return null;
  const options = otherRoads(index, edges);
  const sharesRoad = options.some((option) => option.roadId === spec.roadId);

  const handleChange = (value: string): void => {
    if (value === NEW_ROAD) {
      if (sharesRoad) onChange({ ...spec, roadId: newRoadId(edges) });
      return;
    }
    const chosen = options.find((option) => option.roadId === value);
    if (chosen) onChange({ ...spec, roadId: chosen.roadId, rowWidthM: chosen.widthM });
  };

  return (
    <div className="road-choice">
      <label htmlFor={selectId} className="number-field__label">
        Which road
      </label>
      <select
        id={selectId}
        className="select"
        value={sharesRoad ? spec.roadId : NEW_ROAD}
        onChange={(event) => handleChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.roadId} value={option.roadId}>
            Same road as edge {option.letters}
          </option>
        ))}
        <option value={NEW_ROAD}>A different road</option>
      </select>
    </div>
  );
}

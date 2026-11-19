import { useEffect, useState } from 'react';
import type { EdgeSpec } from '../../core/types';
import { suggestRoadWidth } from '../../site/roadWidth';
import { useRoads } from '../../site/useRoads';
import { useAppStore } from '../../state/store';
import { DEFAULT_ROAD_ID, isRoad, roadEdgeCount, specForKind } from './edgeChoices';
import type { EdgeKind } from './edgeChoices';
import { EdgeRow } from './EdgeRow';
import { startingWidthNote } from './startingWidth';
import type { StartingWidth } from './startingWidth';

export interface EdgeListProps {
  /** Length of each edge in metres, by index. */
  readonly edgeLengthsM: readonly number[];
}

/** One row per plot edge, lettered to match the markers on the map. */
export function EdgeList({ edgeLengthsM }: EdgeListProps) {
  const edges = useAppStore((state) => state.edges);
  const selectedEdge = useAppStore((state) => state.selectedEdge);
  const setEdge = useAppStore((state) => state.setEdge);
  const setRoadWidth = useAppStore((state) => state.setRoadWidth);
  const selectEdge = useAppStore((state) => state.selectEdge);

  const plot = useAppStore((state) => state.plot);
  const roads = useRoads();
  const [starts, setStarts] = useState<Readonly<Record<number, StartingWidth>>>({});

  // Edge numbers shift when corners are added or removed, so earlier notes no longer apply.
  useEffect(() => setStarts({}), [edges.length]);

  const handleKindChange = (index: number, kind: EdgeKind): void => {
    if (edges[index]?.kind === kind) return;
    const joinsExistingRoad = edges.some((spec) => isRoad(spec) && spec.roadId === DEFAULT_ROAD_ID);
    const suggestion = kind === 'road' && !joinsExistingRoad && plot && roads ? suggestRoadWidth(plot, index, roads) : null;
    const spec = specForKind(kind, edges, suggestion?.widthM);
    setEdge(index, spec);
    setStarts((current) => {
      const rest = Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== index));
      return isRoad(spec) && !joinsExistingRoad ? { ...rest, [index]: { widthM: spec.rowWidthM, suggestion } } : rest;
    });
  };

  const handleSpecChange = (index: number, spec: EdgeSpec): void => setEdge(index, spec);

  const handleRoadWidthChange = (roadId: string, widthM: number): void => {
    setRoadWidth(roadId, widthM);
    // The user has now typed a value: the note about the starting value no longer applies.
    setStarts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => {
          const spec = edges[Number(key)];
          return !(isRoad(spec) && spec.roadId === roadId);
        }),
      ),
    );
  };

  const noteFor = (index: number): string | null => {
    const start = starts[index];
    const spec = edges[index];
    return start && isRoad(spec) && spec.rowWidthM === start.widthM ? startingWidthNote(start) : null;
  };

  return (
    <section className="panel-section" aria-labelledby="edges-heading">
      <h2 id="edges-heading" className="panel-section__title">
        Plot edges
      </h2>
      {roadEdgeCount(edges) === 0 ? (
        <p className="prompt" role="status">
          Mark the edge that faces the road. Setbacks and the height limit are measured from it.
        </p>
      ) : null}
      <ol className="edge-list">
        {edges.map((_, index) => (
          <EdgeRow
            key={index}
            index={index}
            edges={edges}
            lengthM={edgeLengthsM[index] ?? null}
            isSelected={selectedEdge === index}
            startNote={noteFor(index)}
            onSelect={selectEdge}
            onKindChange={handleKindChange}
            onSpecChange={handleSpecChange}
            onRoadWidthChange={handleRoadWidthChange}
          />
        ))}
      </ol>
    </section>
  );
}

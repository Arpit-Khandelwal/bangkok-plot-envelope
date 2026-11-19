import type { EdgeSpec } from '../../core/types';
import { useAppStore } from '../../state/store';
import { roadEdgeCount, roadWidthUpdates, specForKind } from './edgeChoices';
import type { EdgeKind } from './edgeChoices';
import { EdgeRow } from './EdgeRow';

export interface EdgeListProps {
  /** Length of each edge in metres, by index. */
  readonly edgeLengthsM: readonly number[];
}

/** One row per plot edge, lettered to match the markers on the map. */
export function EdgeList({ edgeLengthsM }: EdgeListProps) {
  const edges = useAppStore((state) => state.edges);
  const selectedEdge = useAppStore((state) => state.selectedEdge);
  const setEdge = useAppStore((state) => state.setEdge);
  const selectEdge = useAppStore((state) => state.selectEdge);

  const handleKindChange = (index: number, kind: EdgeKind): void => {
    if (edges[index]?.kind === kind) return;
    setEdge(index, specForKind(kind, edges));
  };

  const handleSpecChange = (index: number, spec: EdgeSpec): void => setEdge(index, spec);

  const handleRoadWidthChange = (roadId: string, widthM: number): void => {
    roadWidthUpdates(useAppStore.getState().edges, roadId, widthM).forEach(([index, spec]) => setEdge(index, spec));
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

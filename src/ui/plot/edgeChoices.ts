import type { EdgeSpec } from '../../core/types';
import { DEFAULT_ROAD_WIDTH_M, DEFAULT_WATERWAY_WIDTH_M } from '../../state/defaults';

export type EdgeKind = EdgeSpec['kind'];

export const DEFAULT_ROAD_ID = 'road-1';

export const KIND_OPTIONS: readonly { readonly value: EdgeKind; readonly label: string }[] = [
  { value: 'neighbour', label: 'Neighbour' },
  { value: 'road', label: 'Road' },
  { value: 'waterway', label: 'Canal' },
];

type RoadSpec = Extract<EdgeSpec, { kind: 'road' }>;

export function isRoad(spec: EdgeSpec | undefined): spec is RoadSpec {
  return spec?.kind === 'road';
}

/** The spec an edge gets when its kind changes. A new road joins road-1 and takes its width. */
export function specForKind(kind: EdgeKind, edges: readonly EdgeSpec[]): EdgeSpec {
  switch (kind) {
    case 'neighbour':
      return { kind: 'neighbour' };
    case 'waterway':
      return { kind: 'waterway', widthM: DEFAULT_WATERWAY_WIDTH_M };
    case 'road': {
      const existing = edges.find((spec): spec is RoadSpec => isRoad(spec) && spec.roadId === DEFAULT_ROAD_ID);
      return { kind: 'road', roadId: DEFAULT_ROAD_ID, rowWidthM: existing?.rowWidthM ?? DEFAULT_ROAD_WIDTH_M };
    }
  }
}

/** A road id no edge uses yet: road-2, road-3 ... */
export function newRoadId(edges: readonly EdgeSpec[]): string {
  const used = new Set(edges.filter(isRoad).map((spec) => spec.roadId));
  let number = 1;
  while (used.has(`road-${number}`)) number += 1;
  return `road-${number}`;
}

export function roadEdgeCount(edges: readonly EdgeSpec[]): number {
  return edges.filter(isRoad).length;
}

/**
 * Edge updates that set a road's width: every edge on the same road gets it, because
 * one road has one width.
 */
export function roadWidthUpdates(edges: readonly EdgeSpec[], roadId: string, widthM: number): [number, EdgeSpec][] {
  return edges.flatMap((spec, index): [number, EdgeSpec][] =>
    isRoad(spec) && spec.roadId === roadId ? [[index, { ...spec, rowWidthM: widthM }]] : [],
  );
}

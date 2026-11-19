/**
 * Which road edges limit height, from the site alone (MR 55 ข้อ 44 to 46, research 4.1).
 *
 * Height at any point is at most twice the distance to the far side of the nearest public road, so
 * every road contributes its planes and the lowest governs at each point. The wider road may govern
 * alone only (ข้อ 46) at a corner of two roads, when the building's length along the narrower road is
 * at most 60 m, or (ข้อ 45) between two roads on opposite sides at most 60 m apart, when the
 * building's width along the wider road is at most 60 m. The tool does not know the building yet, so
 * it drops the narrower road only when the condition holds for any building on this plot: it
 * measures the plot, not the building. Roads of equal width both apply.
 *
 * Within one road, an edge that runs more than 45 degrees off the road's length-weighted dominant
 * direction, between two edges of the same road that run along it, is a step in the frontage, not
 * a length of road, and sets no plane of its own.
 *
 * The resolver and the height check both call this, so the check never trusts the resolver's list.
 */
import { axesAngleDeg, axisAngleDeg, dominantAxis, extentAlong } from '../geom/direction';
import type { EdgeInfo, HeightPlane, Pt, Site } from '../types';
import { edgeList, m } from './format';
import { collectRoads } from './context';
import type { RoadFront } from './context';

/** Largest building length (ข้อ 46) or width and road spacing (ข้อ 45) for the wider road to govern. */
export const WIDER_ROAD_MAX_M = 60;
/** Two roads within this angle of parallel are on opposite sides of the plot. */
export const PARALLEL_ROADS_DEG = 30;
/** A road edge more than this far off the road's direction is a step across it. */
export const STEP_EDGE_DEG = 45;

interface RoadGroup {
  readonly road: RoadFront;
  readonly edges: readonly EdgeInfo[];
  readonly axis: Pt | null;
  /** Edges that run along the road and so set a height plane. */
  readonly frontEdges: readonly EdgeInfo[];
  readonly steps: readonly EdgeInfo[];
}

export interface HeightRoads {
  readonly planes: readonly HeightPlane[];
  /** Ids of the roads whose planes apply. */
  readonly roadIds: readonly string[];
  /** Plain sentences on which roads apply and why, with the measured lengths. */
  readonly notes: readonly string[];
}

function groupOf(site: Site, road: RoadFront): RoadGroup {
  const edges = road.edgeIndices.flatMap((i) => (site.edges[i] === undefined ? [] : [site.edges[i] as EdgeInfo]));
  const axis = dominantAxis(edges);
  const inGroup = new Set(road.edgeIndices);
  const n = site.edges.length;
  const along = (e: EdgeInfo | undefined): boolean =>
    e !== undefined && inGroup.has(e.index) && (axis === null || axisAngleDeg(e, axis) <= STEP_EDGE_DEG);
  // A step lies between two along-road edges of the same road. An off-direction edge at the end of
  // a run, such as the second side of a road that wraps a corner, is still road and keeps its plane.
  const isStep = (e: EdgeInfo): boolean =>
    !along(e) && along(site.edges[(e.index - 1 + n) % n]) && along(site.edges[(e.index + 1) % n]);
  return { road, edges, axis, frontEdges: edges.filter((e) => !isStep(e)), steps: edges.filter(isStep) };
}

function shareCorner(site: Site, a: RoadGroup, b: RoadGroup): boolean {
  const n = site.edges.length;
  const inA = new Set(a.road.edgeIndices);
  const inB = new Set(b.road.edgeIndices);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if ((inA.has(i) && inB.has(j)) || (inB.has(i) && inA.has(j))) return true;
  }
  return false;
}

function span(points: readonly Pt[], axis: Pt): number {
  const e = extentAlong(points, axis);
  return e.max - e.min;
}

function roadName(site: Site, g: RoadGroup): string {
  return `the ${m(g.road.rowWidthM)} road (${edgeList(site, g.road.edgeIndices)})`;
}

interface Exception {
  readonly holds: boolean;
  readonly note: string;
}

function cornerCase(site: Site, wide: RoadGroup, narrow: RoadGroup, narrowAxis: Pt): Exception {
  const length = span(site.ring, narrowAxis);
  const lead = `${roadName(site, wide)} and ${roadName(site, narrow)} meet at a corner of the plot, which runs ${m(length)} along the narrower road`;
  if (length <= WIDER_ROAD_MAX_M) {
    return {
      holds: true,
      note: `${lead}: no building here can be longer than ${m(WIDER_ROAD_MAX_M)} along it, so the wider road governs (corner rule, MR 55 clause 46) and the narrower road sets no height limit.`,
    };
  }
  return {
    holds: false,
    note: `${lead}, more than ${m(WIDER_ROAD_MAX_M)}: a building could be longer than the corner rule (MR 55 clause 46) allows, so both roads limit height.`,
  };
}

function oppositeCase(site: Site, wide: RoadGroup, narrow: RoadGroup, wideAxis: Pt): Exception {
  const normal = { x: -wideAxis.y, y: wideAxis.x };
  const ends = [...wide.edges, ...narrow.edges].flatMap((e) => [e.from, e.to]);
  const apart = span(ends, normal);
  const width = span(site.ring, wideAxis);
  const lead = `${roadName(site, wide)} and ${roadName(site, narrow)} lie on opposite sides of the plot, up to ${m(apart)} apart, and the plot is ${m(width)} wide along the wider road`;
  if (apart <= WIDER_ROAD_MAX_M && width <= WIDER_ROAD_MAX_M) {
    return {
      holds: true,
      note: `${lead}: both are within ${m(WIDER_ROAD_MAX_M)}, so the wider road governs (two-road rule, MR 55 clause 45) and the narrower road sets no height limit.`,
    };
  }
  const why = apart > WIDER_ROAD_MAX_M ? `the roads are more than ${m(WIDER_ROAD_MAX_M)} apart` : `a building could be wider than ${m(WIDER_ROAD_MAX_M)} along the wider road`;
  return { holds: false, note: `${lead}: ${why}, so the two-road rule (MR 55 clause 45) cannot be relied on and both roads limit height.` };
}

/** Whether the narrower road's planes may be dropped in favour of the wider one, and why. */
function exception(site: Site, wide: RoadGroup, narrow: RoadGroup): Exception {
  if (wide.axis === null || narrow.axis === null) {
    return { holds: false, note: `${roadName(site, narrow)} also limits height.` };
  }
  if (shareCorner(site, wide, narrow)) return cornerCase(site, wide, narrow, narrow.axis);
  if (axesAngleDeg(wide.axis, narrow.axis) <= PARALLEL_ROADS_DEG) return oppositeCase(site, wide, narrow, wide.axis);
  return {
    holds: false,
    note: `${roadName(site, wide)} and ${roadName(site, narrow)} neither meet at a corner nor lie on opposite sides, so both limit height.`,
  };
}

function stepNote(site: Site, g: RoadGroup): readonly string[] {
  if (g.steps.length === 0) return [];
  const which = edgeList(site, g.steps.map((e) => e.index));
  return [
    `On ${roadName(site, g)}, ${which} ${g.steps.length === 1 ? 'runs' : 'run'} across the road rather than along it (a step in the frontage), so the height limit is measured from the other edges.`,
  ];
}

/** Picks the roads, widest first: a narrower road is dropped only in favour of a wider road that itself applies. */
function chooseRoads(site: Site, groups: readonly RoadGroup[]): { readonly kept: readonly RoadGroup[]; readonly notes: readonly string[] } {
  const kept: RoadGroup[] = [];
  const notes: string[] = [];
  const widestFirst = [...groups].sort((a, b) => b.road.rowWidthM - a.road.rowWidthM);
  for (const g of widestFirst) {
    const results = kept.filter((w) => w.road.rowWidthM > g.road.rowWidthM).map((w) => exception(site, w, g));
    const dropping = results.find((r) => r.holds);
    if (dropping !== undefined) {
      notes.push(dropping.note);
      continue;
    }
    notes.push(...results.map((r) => r.note));
    if (kept.some((w) => w.road.rowWidthM === g.road.rowWidthM)) {
      notes.push(`${roadName(site, g)} is as wide as another road here, so each limits height along its own edges.`);
    }
    kept.push(g);
  }
  return { kept, notes };
}

export function heightRoads(site: Site, slope: number, ruleId: string): HeightRoads {
  const groups = collectRoads(site).map((road) => groupOf(site, road));
  const { kept, notes } = chooseRoads(site, groups);
  const planes = kept.flatMap((g) =>
    g.frontEdges.map((e) => ({ edgeIndex: e.index, rowWidthM: g.road.rowWidthM, slope, ruleId })),
  );
  return {
    planes,
    roadIds: kept.map((g) => g.road.roadId),
    notes: [...notes, ...kept.flatMap((g) => stepNote(site, g))],
  };
}

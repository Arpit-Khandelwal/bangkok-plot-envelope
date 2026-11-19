/**
 * The front open space of the Bangkok ordinance B.E. 2544 ข้อ 52(6) (DECISIONS.md B12): open ground
 * of a required width in front of the building, continuous along at least one sixth of its external
 * perimeter (side open space joined to it counts), linked to a public road through open ground at
 * least 6 m wide. Measured on the outline by sampling: a point of the outline counts when the open
 * ground straight out from it, at right angles to the wall, reaches the required width before it
 * meets the plot boundary or the building.
 */
import { difference, openRegion, pointInRegion } from '../geom';
import type { BuildingType, EdgeInfo, Pt, Region, Ring, Site } from '../types';

/** Front open space width, and the width for a building over 3 storeys (ข้อ 52(6) first and second paragraphs). */
export const FRONT_OPEN_SPACE_M = 6;
export const FRONT_OPEN_SPACE_TALL_M = 12;
/** The open space must run along at least this share of the external perimeter. */
export const FRONT_OPEN_SPACE_SHARE = 1 / 6;
/** Width of the internal road that links the open space to a public road. */
export const INTERNAL_ROAD_M = 6;
/** ข้อ 52(6) applies above these: over 2 storeys or over 8 m; the wider space over 3 storeys. */
const MAX_STOREYS_WITHOUT = 2;
const MAX_HEIGHT_WITHOUT_M = 8;
const MAX_STOREYS_NARROW = 3;
/** Outline sampling step, and the most samples taken on one outline (the step grows past it). */
const SAMPLE_STEP_M = 0.25;
const MAX_SAMPLES = 400;
const WIDTH_TOLERANCE_M = 0.02;
/** A ray starts this far outside the wall, so it does not meet the wall it leaves. */
const RAY_START_M = 1e-3;
/** An opened piece of open ground this close to a road edge reaches the road. */
const TOUCH_TOLERANCE_M = 0.05;

/**
 * The front open-space width ข้อ 52(6) asks of this building when it applies to every building it
 * lists (reading B), or null when it does not list this building: a commercial building (an office,
 * DECISIONS.md B13) always, any building over 2 storeys or 8 m; 12 m over 3 storeys.
 */
export function frontOpenSpaceWidth(type: BuildingType, storeys: number, heightM: number): number | null {
  const listed = type === 'office' || storeys > MAX_STOREYS_WITHOUT || heightM > MAX_HEIGHT_WITHOUT_M;
  if (!listed) return null;
  return storeys > MAX_STOREYS_NARROW ? FRONT_OPEN_SPACE_TALL_M : FRONT_OPEN_SPACE_M;
}

export interface FrontOpenSpace {
  readonly widthM: number;
  /**
   * Longest continuous part of the outline with the open width in front of it: the one that reaches
   * the road when one long enough does (`linked`), else the longest.
   */
  readonly runM: number;
  /** True when a stretch long enough to count reaches the road through open ground 6 m wide. */
  readonly linked: boolean;
  /** External perimeter of the building (outer rings). */
  readonly perimeterM: number;
  /** One sixth of the perimeter. */
  readonly neededM: number;
  readonly meets: boolean;
}

interface Sample {
  readonly at: Pt;
  readonly normal: Pt;
  readonly lengthM: number;
}

function ringLength(ring: Ring): number {
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i] as Pt;
    const q = ring[(i + 1) % ring.length] as Pt;
    total += Math.hypot(q.x - p.x, q.y - p.y);
  }
  return total;
}

function samplesOf(ring: Ring): Sample[] {
  const out: Sample[] = [];
  const step = Math.max(SAMPLE_STEP_M, ringLength(ring) / MAX_SAMPLES);
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i] as Pt;
    const q = ring[(i + 1) % ring.length] as Pt;
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (!(len > 0)) continue;
    // Outer rings run counter-clockwise, so the outward normal is to the right.
    const normal = { x: (q.y - p.y) / len, y: -(q.x - p.x) / len };
    const count = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;
      out.push({ at: { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) }, normal, lengthM: len / count });
    }
  }
  return out;
}

/** Distance along the ray from `o` in direction `d` to segment a-b, or Infinity when it misses. */
function rayHit(o: Pt, d: Pt, a: Pt, b: Pt): number {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const denom = d.x * ey - d.y * ex;
  if (Math.abs(denom) < 1e-12) return Number.POSITIVE_INFINITY;
  const wx = a.x - o.x;
  const wy = a.y - o.y;
  const s = (wx * ey - wy * ex) / denom;
  const u = (wx * d.y - wy * d.x) / denom;
  return s >= 0 && u >= 0 && u <= 1 ? s : Number.POSITIVE_INFINITY;
}

interface Seg {
  readonly a: Pt;
  readonly b: Pt;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function segmentsOf(rings: readonly Ring[]): Seg[] {
  return rings.flatMap((ring) =>
    ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length] as Pt;
      return { a, b, minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) };
    }),
  );
}

/** Distance from `o` along `d` to the first segment, looking no further than `reachM`. */
function clearAhead(o: Pt, d: Pt, segs: readonly Seg[], reachM: number): number {
  const ex = o.x + d.x * reachM;
  const ey = o.y + d.y * reachM;
  const minX = Math.min(o.x, ex);
  const maxX = Math.max(o.x, ex);
  const minY = Math.min(o.y, ey);
  const maxY = Math.max(o.y, ey);
  let best = Number.POSITIVE_INFINITY;
  for (const s of segs) {
    if (s.maxX < minX || s.minX > maxX || s.maxY < minY || s.minY > maxY) continue;
    best = Math.min(best, rayHit(o, d, s.a, s.b));
  }
  return best;
}

function roadEdges(site: Site): readonly EdgeInfo[] {
  return site.edges.filter((e) => e.spec.kind === 'road' && e.lengthM > 0);
}

/** Pieces of the open ground at least 6 m wide that reach a road edge. */
function linkedOpenGround(site: Site, footprint: Region): Region {
  const open = openRegion(difference([{ outer: site.ring, holes: [] }], footprint), INTERNAL_ROAD_M);
  const roads = roadEdges(site);
  return open.filter((poly) => roads.some((e) => minDistance(poly.outer, e.from, e.to) <= TOUCH_TOLERANCE_M));
}

function minDistance(ring: Ring, a: Pt, b: Pt): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i] as Pt;
    const q = ring[(i + 1) % ring.length] as Pt;
    best = Math.min(best, pointSegment(p, a, b), pointSegment(a, p, q), pointSegment(b, p, q));
  }
  return best;
}

function pointSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

interface Run {
  readonly lengthM: number;
  readonly samples: readonly Sample[];
}

/** The cyclic runs of clear samples on one ring. */
function clearRuns(samples: readonly Sample[], clear: readonly boolean[]): Run[] {
  const n = samples.length;
  if (n === 0 || !clear.some(Boolean)) return [];
  if (clear.every(Boolean)) return [{ lengthM: samples.reduce((s, x) => s + x.lengthM, 0), samples }];
  const start = clear.findIndex((c) => !c);
  const runs: Run[] = [];
  let current: Sample[] = [];
  for (let k = 1; k <= n; k++) {
    const i = (start + k) % n;
    const sample = samples[i];
    if (clear[i] && sample !== undefined) {
      current.push(sample);
      continue;
    }
    if (current.length > 0) runs.push({ lengthM: current.reduce((s, x) => s + x.lengthM, 0), samples: current });
    current = [];
  }
  return runs;
}

/**
 * The ข้อ 52(6) front open space of width `widthM` around `footprint`. Whether a stretch reaches the
 * road through open ground 6 m wide is worked out only for stretches long enough to count.
 */
export function frontOpenSpace(site: Site, footprint: Region, widthM: number, checkLink = true): FrontOpenSpace {
  const segs = segmentsOf([site.ring, ...footprint.flatMap((p) => [p.outer, ...p.holes])]);
  const need = widthM - WIDTH_TOLERANCE_M - RAY_START_M;
  let perimeterM = 0;
  const runs: Run[] = [];
  for (const poly of footprint) {
    const samples = samplesOf(poly.outer);
    perimeterM += samples.reduce((s, x) => s + x.lengthM, 0);
    const clear = samples.map((s) => {
      const o = { x: s.at.x + s.normal.x * RAY_START_M, y: s.at.y + s.normal.y * RAY_START_M };
      return clearAhead(o, s.normal, segs, widthM) >= need;
    });
    runs.push(...clearRuns(samples, clear));
  }
  const neededM = FRONT_OPEN_SPACE_SHARE * perimeterM;
  const longest = Math.max(0, ...runs.map((r) => r.lengthM));
  const candidates = runs.filter((r) => r.lengthM >= neededM).sort((x, y) => y.lengthM - x.lengthM);
  if (!(perimeterM > 0) || candidates.length === 0) return { widthM, runM: longest, perimeterM, neededM, linked: false, meets: false };
  // A search may skip the link (the costly part) and confirm it once on its result.
  if (!checkLink) return { widthM, runM: candidates[0]?.lengthM ?? longest, perimeterM, neededM, linked: false, meets: true };
  const ground = linkedOpenGround(site, footprint);
  const reaches = (r: Run): boolean =>
    r.samples.some((s) => pointInRegion({ x: s.at.x + (s.normal.x * widthM) / 2, y: s.at.y + (s.normal.y * widthM) / 2 }, ground));
  const linkedRun = candidates.find(reaches);
  return linkedRun === undefined
    ? { widthM, runM: longest, perimeterM, neededM, linked: false, meets: false }
    : { widthM, runM: linkedRun.lengthM, perimeterM, neededM, linked: true, meets: true };
}

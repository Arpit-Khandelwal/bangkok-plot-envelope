/**
 * Internal bridge between `Region` (metres, floats) and clipper2-ts (integer grid).
 * Rings are snapped to the CLIPPER_SCALE grid, outer rings forced counter-clockwise
 * and holes clockwise, and every boolean is run with the NonZero fill rule, so
 * overlapping input polygons are treated as their union.
 */
import { booleanOpWithPolyTree, ClipType, FillRule, PolyTree64 } from 'clipper2-ts';
import type { Path64, Paths64, PolyPath64 } from 'clipper2-ts';
import type { Polygon, Pt, Region, Ring } from '../types';
import { CLIPPER_SCALE } from './tolerance';

function ringArea64(path: Path64): number {
  let s = 0;
  const n = path.length;
  for (let i = 0; i < n; i++) {
    const a = path[i] as Pt;
    const b = path[(i + 1) % n] as Pt;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** Snap a ring to the grid with the requested orientation; null when degenerate. */
export function ringToPath(ring: Ring, ccw: boolean): Path64 | null {
  const out: Path64 = [];
  for (const p of ring) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const q = { x: Math.round(p.x * CLIPPER_SCALE), y: Math.round(p.y * CLIPPER_SCALE) };
    const last = out[out.length - 1];
    if (last && last.x === q.x && last.y === q.y) continue;
    out.push(q);
  }
  while (out.length > 1) {
    const first = out[0] as Pt;
    const last = out[out.length - 1] as Pt;
    if (first.x !== last.x || first.y !== last.y) break;
    out.pop();
  }
  if (out.length < 3) return null;
  const a = ringArea64(out);
  if (a === 0) return null;
  return a > 0 === ccw ? out : out.reverse();
}

export function regionToPaths(region: Region): Paths64 {
  const paths: Paths64 = [];
  for (const poly of region) {
    const outer = ringToPath(poly.outer, true);
    if (!outer) continue;
    paths.push(outer);
    for (const hole of poly.holes) {
      const h = ringToPath(hole, false);
      if (h) paths.push(h);
    }
  }
  return paths;
}

function pathToRing(path: Path64, ccw: boolean): Pt[] {
  const pts = path.map((p) => ({ x: p.x / CLIPPER_SCALE, y: p.y / CLIPPER_SCALE }));
  return ringArea64(path) > 0 === ccw ? pts : pts.reverse();
}

/** Area of a grid path in m2 (unsigned). */
function pathAreaM2(path: Path64): number {
  return Math.abs(ringArea64(path)) / (CLIPPER_SCALE * CLIPPER_SCALE);
}

function collect(node: PolyPath64, minArea: number, out: Polygon[]): void {
  for (let i = 0; i < node.count; i++) {
    const outerNode = node.child(i);
    const outer = outerNode.poly;
    if (!outer || outer.length < 3) continue;
    const holes: Pt[][] = [];
    for (let j = 0; j < outerNode.count; j++) {
      const holeNode = outerNode.child(j);
      const hole = holeNode.poly;
      if (hole && hole.length >= 3 && pathAreaM2(hole) > minArea) holes.push(pathToRing(hole, false));
      // Islands inside a hole are separate polygons.
      collect(holeNode, minArea, out);
    }
    if (pathAreaM2(outer) <= minArea) continue;
    out.push({ outer: pathToRing(outer, true), holes });
  }
}

/** Polygons from a clipper solution tree, dropping rings with area <= minArea (m2). */
export function treeToRegion(tree: PolyTree64, minArea: number): Region {
  const out: Polygon[] = [];
  collect(tree, minArea, out);
  return out;
}

export type BoolOp = 'union' | 'difference' | 'intersection';

const CLIP_TYPE: Readonly<Record<BoolOp, ClipType>> = {
  union: ClipType.Union,
  difference: ClipType.Difference,
  intersection: ClipType.Intersection,
};

/** Run one boolean on grid paths and return a Region (in metres). */
export function booleanPaths(op: BoolOp, subject: Paths64, clip: Paths64, minArea: number): Region {
  if (subject.length === 0 && op !== 'union') return [];
  if (subject.length === 0 && clip.length === 0) return [];
  const tree = new PolyTree64();
  booleanOpWithPolyTree(CLIP_TYPE[op], subject, clip.length > 0 ? clip : null, tree, FillRule.NonZero);
  return treeToRegion(tree, minArea);
}

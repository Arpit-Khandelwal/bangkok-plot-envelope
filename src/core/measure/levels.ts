/**
 * Levels of a design. A shared level is two Floor entries with the same `level` (parking at the
 * back, main use at the road side), so anything counted "per floor" in the law is counted per level.
 */
import type { Floor } from '../types';

/** Number of distinct levels: the storeys. */
export function levelCount(floors: readonly Floor[]): number {
  return new Set(floors.map((f) => f.level)).size;
}

/** Area of each level, all its entries together, using `areaOf` to measure an entry. */
export function levelAreas(floors: readonly Floor[], areaOf: (f: Floor) => number = (f) => f.areaM2): readonly number[] {
  const byLevel = new Map<number, number>();
  for (const f of floors) byLevel.set(f.level, (byLevel.get(f.level) ?? 0) + areaOf(f));
  return [...byLevel.values()];
}

/** Levels with any parking, and how many of them also hold main use. */
export function parkingLevels(floors: readonly Floor[]): { readonly count: number; readonly shared: number } {
  const parking = new Set(floors.filter((f) => f.use === 'parking').map((f) => f.level));
  const shared = [...parking].filter((lv) => floors.some((f) => f.level === lv && f.use !== 'parking')).length;
  return { count: parking.size, shared };
}

/** Highest floor top. */
export function roofDeck(floors: readonly Floor[]): number {
  return floors.reduce((m, f) => Math.max(m, f.topM), 0);
}

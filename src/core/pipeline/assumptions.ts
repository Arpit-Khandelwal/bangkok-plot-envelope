/**
 * Developer assumptions arrive from number fields and may be blank, zero or absurd. The pipeline
 * reads them through this clamp so that a bad value can never stall the floor stacking (a zero
 * floor height) or produce non-finite totals. Values inside the ranges pass through unchanged;
 * every value that is changed is reported as a non-blocking problem, never clamped silently.
 */
import { num } from '../rules/format';
import type { Assumptions, Problem } from '../types';

interface Range {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
  /** Plain name of the field, as the assumptions form labels it. */
  readonly label: string;
  readonly unit: string;
}

/** Bounds are physical sanity limits, not law; legal minimums are applied separately. */
const RANGES: Readonly<Record<keyof Assumptions, Range>> = {
  floorToFloorM: { min: 2, max: 10, fallback: 3.1, label: 'Floor-to-floor height', unit: ' m' },
  // 2.1 m clear height under the next floor (MR 41 ข้อ 4) plus the structure above.
  parkingFloorToFloorM: { min: 2.4, max: 10, fallback: 3, label: 'Parking floor-to-floor height', unit: ' m' },
  efficiency: { min: 0, max: 1, fallback: 0.7, label: 'Sellable share of non-parking floor area', unit: '' },
  averageUnitM2: { min: 20, max: 10_000, fallback: 35, label: 'Average unit size', unit: ' m²' },
  shareOfUnitsOver60M2: { min: 0, max: 1, fallback: 0.15, label: 'Units of 60 m² or more', unit: '' },
  // A 2.4 x 5 m stall plus half a 6 m aisle is 26.4 m² (research/01-regulations.md §5.1); 20 m² is
  // the least that can hold a stall with any aisle at all.
  parkingM2PerStall: { min: 20, max: 200, fallback: 28, label: 'Parking floor area per car', unit: ' m²' },
  parapetM: { min: 0, max: 20, fallback: 1.2, label: 'Parapet and rooftop structure', unit: ' m' },
};

const KEYS = Object.keys(RANGES) as readonly (keyof Assumptions)[];

function clamp(value: number, range: Range): number {
  if (!Number.isFinite(value)) return range.fallback;
  return Math.min(range.max, Math.max(range.min, value));
}

function adjustedProblem(range: Range, entered: number, used: number): Problem {
  const was = Number.isFinite(entered) ? `${num(entered)}${range.unit}` : 'blank (not a number)';
  return {
    code: 'assumption-adjusted',
    message: `${range.label}: the value entered, ${was}, is outside the range the tool can use (${num(range.min)} to ${num(range.max)}${range.unit}), so ${num(used)}${range.unit} is used instead.`,
    blocking: false,
  };
}

export interface SaneAssumptions {
  readonly assumptions: Assumptions;
  readonly problems: readonly Problem[];
}

export function saneAssumptions(a: Assumptions): SaneAssumptions {
  const used = Object.fromEntries(KEYS.map((key) => [key, clamp(a[key], RANGES[key])])) as unknown as Assumptions;
  const problems = KEYS.flatMap((key) =>
    used[key] === a[key] ? [] : [adjustedProblem(RANGES[key], a[key], used[key])],
  );
  return { assumptions: used, problems };
}

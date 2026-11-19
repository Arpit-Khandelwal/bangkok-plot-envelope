import type { LngLat } from '../../core/types';

export const MIN_CORNERS = 3;
export const MAX_CORNERS = 200;
const LAT_RANGE = { min: 13.4, max: 14.1 } as const;
const LNG_RANGE = { min: 100.2, max: 101.0 } as const;
const COORDINATE_DECIMALS = 6;
const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const SEPARATOR = /[\s,;]+/;

export type ParsedCorners =
  | { readonly ok: true; readonly plot: readonly LngLat[] }
  | { readonly ok: false; readonly message: string };

export const CORNER_FORMAT_HINT = `One corner per line, as latitude, longitude in decimal degrees, for example 13.68930, 100.60900. At least ${MIN_CORNERS} corners. Longitude first also works.`;

function within(value: number, range: { readonly min: number; readonly max: number }): boolean {
  return value >= range.min && value <= range.max;
}

function fail(message: string): ParsedCorners {
  return { ok: false, message };
}

/** One line to [longitude, latitude], or an error message that names the line. */
function parseLine(line: string, lineNumber: number): LngLat | string {
  const parts = line.trim().split(SEPARATOR).filter((part) => part !== '');
  if (parts.length !== 2 || parts.some((part) => !NUMBER_PATTERN.test(part))) {
    return `Line ${lineNumber} is not a pair of numbers. Write it like 13.68930, 100.60900.`;
  }
  const first = Number(parts[0]);
  const second = Number(parts[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return `Line ${lineNumber} is not a pair of numbers. Write it like 13.68930, 100.60900.`;
  if (within(first, LAT_RANGE) && within(second, LNG_RANGE)) return [second, first];
  if (within(second, LAT_RANGE) && within(first, LNG_RANGE)) return [first, second];
  return `Line ${lineNumber} is outside Bangkok. Latitude should be ${LAT_RANGE.min} to ${LAT_RANGE.max} and longitude ${LNG_RANGE.min} to ${LNG_RANGE.max}.`;
}

/**
 * Reads corners typed as text, one per line. Accepts latitude, longitude or longitude, latitude
 * (told apart by range), separated by commas, spaces or tabs. Blank lines are ignored. A last
 * corner that repeats the first is dropped, since the plot is closed automatically.
 */
export function parseCorners(text: string): ParsedCorners {
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter((entry) => entry.line.trim() !== '');
  if (lines.length > MAX_CORNERS) return fail(`Enter at most ${MAX_CORNERS} corners. There are ${lines.length}.`);

  const corners: LngLat[] = [];
  for (const entry of lines) {
    const corner = parseLine(entry.line, entry.number);
    if (typeof corner === 'string') return fail(corner);
    corners.push(corner);
  }
  const first = corners[0];
  const last = corners[corners.length - 1];
  const closed = corners.length > MIN_CORNERS && first && last && first[0] === last[0] && first[1] === last[1];
  const plot = closed ? corners.slice(0, -1) : corners;
  if (plot.length < MIN_CORNERS) return fail(`Enter at least ${MIN_CORNERS} corners, one per line. There ${plot.length === 1 ? 'is 1' : `are ${plot.length}`}.`);
  return { ok: true, plot };
}

/** A plot as the text the form reads back: latitude, longitude to 6 decimals, one corner per line. */
export function formatCorners(plot: readonly LngLat[]): string {
  return plot.map(([lng, lat]) => `${lat.toFixed(COORDINATE_DECIMALS)}, ${lng.toFixed(COORDINATE_DECIMALS)}`).join('\n');
}

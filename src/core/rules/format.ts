/** Number formatting for rule sentences. Locale-independent so output is repeatable. */

const MAX_LENGTH_DECIMALS = 2;

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Fixed decimals, trailing zeros removed, thousands separated: 12500 -> "12,500", 3.005 -> "3.01". */
export function formatNumber(value: number, maxDecimals: number): string {
  if (!Number.isFinite(value)) return value > 0 ? 'unlimited' : '-unlimited';
  const fixed = value.toFixed(maxDecimals);
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  const [intPart = '0', decPart] = trimmed.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const grouped = groupThousands(intPart.replace('-', ''));
  const out = decPart === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${decPart}`;
  return out === '-0' ? '0' : out;
}

/** Areas: whole square metres. */
export function m2(value: number): string {
  return `${formatNumber(Math.round(value), 0)} m²`;
}

/** Lengths: up to two decimals. */
export function m(value: number): string {
  return `${formatNumber(value, MAX_LENGTH_DECIMALS)} m`;
}

/** Shares as percentages: 0.06 -> "6%". */
export function pct(share: number): string {
  return `${formatNumber(share * 100, 1)}%`;
}

/** Plain number, up to two decimals. */
export function num(value: number): string {
  return formatNumber(value, MAX_LENGTH_DECIMALS);
}

/** A value and the limit it is compared with, both as displayed. */
export interface ComparedText {
  readonly value: string;
  readonly limit: string;
}

/** Most decimals used to show a value apart from its limit. */
const MAX_COMPARE_DECIMALS = 6;
/** A scaled value this close to a whole number is taken as that number (floating-point noise). */
const SNAP_EPSILON = 1e-6;

/** Rounds toward the side of the limit the value is on: down below it, up above it. */
function directed(value: number, decimals: number, side: number): number {
  const scale = 10 ** decimals;
  const scaled = value * scale;
  const near = Math.round(scaled);
  if (Math.abs(scaled - near) < SNAP_EPSILON) return near / scale;
  return (side < 0 ? Math.floor(scaled) : Math.ceil(scaled)) / scale;
}

function parseShown(text: string): number {
  return Number(text.replace(/,/g, ''));
}

/** True when both displayed numbers sit on the same side of each other as the true value does of the limit. */
function agrees(valueText: string, limitText: string, limit: number, side: number): boolean {
  const shown = parseShown(valueText);
  return Math.sign(shown - limit) === side && Math.sign(shown - parseShown(limitText)) === side;
}

/**
 * A value and its limit as displayed, never contradicting the comparison. Away from the limit both
 * round normally to `baseDecimals`. When that would show the value on or across the limit, the value
 * is rounded toward the side it is actually on, from `directedDecimals` upward, until the displayed
 * numbers differ: 22.998 against 23 shows "22.99", 500.01 against 500 shows "500.01".
 */
export function formatAgainst(value: number, limit: number, baseDecimals: number, directedDecimals: number): ComparedText {
  const normal = { value: formatNumber(value, baseDecimals), limit: formatNumber(limit, baseDecimals) };
  const side = Math.sign(value - limit);
  if (!Number.isFinite(value) || !Number.isFinite(limit) || side === 0) return normal;
  if (agrees(normal.value, normal.limit, limit, side)) return normal;
  for (let d = Math.max(baseDecimals, directedDecimals); d <= MAX_COMPARE_DECIMALS; d++) {
    const pair = { value: formatNumber(directed(value, d, side), d), limit: formatNumber(limit, d) };
    if (agrees(pair.value, pair.limit, limit, side)) return pair;
  }
  return { value: formatNumber(value, MAX_COMPARE_DECIMALS), limit: formatNumber(limit, MAX_COMPARE_DECIMALS) };
}

/** A length compared with a limit, e.g. a roof deck against 23 m. */
export function mVs(value: number, limit: number, baseDecimals: number = MAX_LENGTH_DECIMALS): ComparedText {
  const t = formatAgainst(value, limit, baseDecimals, MAX_LENGTH_DECIMALS);
  return { value: `${t.value} m`, limit: `${t.limit} m` };
}

/** An area compared with a limit: whole square metres, or tenths when that is needed to show the difference. */
export function m2Vs(value: number, limit: number): ComparedText {
  const t = formatAgainst(value, limit, 0, 1);
  return { value: `${t.value} m²`, limit: `${t.limit} m²` };
}

/** A plain number compared with a limit. */
export function numVs(value: number, limit: number): ComparedText {
  return formatAgainst(value, limit, MAX_LENGTH_DECIMALS, MAX_LENGTH_DECIMALS);
}

/** "edge A", "edges A and C": site-edge indices named by the letter of the drawn edge. */
export { edgeListText as edgeList } from '../edgeNames';

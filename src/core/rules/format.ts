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

/** "edge A", "edges A and C": site-edge indices named by the letter of the drawn edge. */
export { edgeListText as edgeList } from '../edgeNames';

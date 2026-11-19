/** Display formatting for the interface. Locale-independent so output is repeatable in tests. */

const M2_PER_SQ_WAH = 4;
const SQ_WAH_PER_NGAN = 100;
const SQ_WAH_PER_RAI = 400;
/** Square wah are shown to two decimals, so conversion works in hundredths. */
const HUNDREDTHS = 100;

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Thousands separated, at most `maxDecimals` decimals, trailing zeros removed: 12500 -> "12,500". */
export function formatNumber(value: number, maxDecimals = 0): string {
  if (!Number.isFinite(value)) return '–';
  const fixed = Math.abs(value).toFixed(maxDecimals);
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  const [whole = '0', fraction] = trimmed.split('.');
  const sign = value < 0 && trimmed !== '0' ? '−' : '';
  return `${sign}${groupThousands(whole)}${fraction === undefined ? '' : `.${fraction}`}`;
}

/** Whole square metres: "12,500 m²". */
export function formatM2(value: number): string {
  return `${formatNumber(Math.round(value))} m²`;
}

/** Square metres with exactly one decimal, so rows can be added by hand: "1,234.5 m²", "340.0 m²". */
export function formatM2Tenths(value: number): string {
  if (!Number.isFinite(value)) return '–';
  const [whole = '0', fraction = '0'] = Math.abs(value).toFixed(1).split('.');
  const sign = value < 0 && Math.abs(value) >= 0.05 ? '−' : '';
  return `${sign}${groupThousands(whole)}.${fraction} m²`;
}

/** Lengths to one decimal: "12.5 m", "6 m". */
export function formatMetres(value: number, maxDecimals = 1): string {
  return `${formatNumber(value, maxDecimals)} m`;
}

/** A share from 0 to 1 as a percentage: 0.065 -> "6.5%". */
export function formatPercent(share: number, maxDecimals = 1): string {
  return `${formatNumber(share * 100, maxDecimals)}%`;
}

/** Floor area ratio: "4.25". */
export function formatRatio(value: number): string {
  return formatNumber(value, 2);
}

/**
 * Thai land units: 1 rai = 1,600 m², 1 ngan = 400 m², 1 square wah = 4 m².
 * Rounds to hundredths of a square wah first and splits with integers, so 1,599.99 m²
 * becomes "1 rai", never "3 ngan 100 sq wah".
 */
export function formatRaiNganWah(areaM2: number): string {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return '0 sq wah';
  const totalHundredths = Math.round((areaM2 / M2_PER_SQ_WAH) * HUNDREDTHS);
  const raiUnit = SQ_WAH_PER_RAI * HUNDREDTHS;
  const nganUnit = SQ_WAH_PER_NGAN * HUNDREDTHS;
  const rai = Math.floor(totalHundredths / raiUnit);
  const ngan = Math.floor((totalHundredths % raiUnit) / nganUnit);
  const wahHundredths = totalHundredths % nganUnit;
  const parts: string[] = [];
  if (rai > 0) parts.push(`${formatNumber(rai)} rai`);
  if (ngan > 0) parts.push(`${ngan} ngan`);
  if (wahHundredths > 0) parts.push(`${formatNumber(wahHundredths / HUNDREDTHS, 2)} sq wah`);
  return parts.length > 0 ? parts.join(' ') : '0 sq wah';
}

/** "1 check", "3 checks". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

/** Ends a sentence taken from data with exactly one full stop. */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

import { describe, expect, it } from 'vitest';
import { asSentence, formatM2, formatMetres, formatNumber, formatPercent, formatRaiNganWah, plural } from './format';

describe('formatNumber', () => {
  it('separates thousands and trims trailing zeros', () => {
    expect(formatNumber(12500)).toBe('12,500');
    expect(formatNumber(1234567.891, 2)).toBe('1,234,567.89');
    expect(formatNumber(3.1, 2)).toBe('3.1');
    expect(formatNumber(0)).toBe('0');
  });

  it('never prints a negative zero', () => {
    expect(formatNumber(-0.001, 1)).toBe('0');
  });
});

describe('units', () => {
  it('formats square metres as whole numbers', () => {
    expect(formatM2(2550.4)).toBe('2,550 m²');
  });

  it('formats metres to one decimal by default', () => {
    expect(formatMetres(12)).toBe('12 m');
    expect(formatMetres(6.25)).toBe('6.3 m');
  });

  it('formats shares as percentages', () => {
    expect(formatPercent(0.06)).toBe('6%');
    expect(formatPercent(0.305)).toBe('30.5%');
  });
});

describe('formatRaiNganWah', () => {
  it('converts exact rai', () => {
    expect(formatRaiNganWah(1600)).toBe('1 rai');
  });

  it('converts a mixed area', () => {
    expect(formatRaiNganWah(2550)).toBe('1 rai 2 ngan 37.5 sq wah');
  });

  it('shows square wah alone below one ngan', () => {
    expect(formatRaiNganWah(399)).toBe('99.75 sq wah');
  });

  it('shows zero as square wah', () => {
    expect(formatRaiNganWah(0)).toBe('0 sq wah');
  });

  it('rounds before splitting so units never overflow', () => {
    expect(formatRaiNganWah(1599.99)).toBe('1 rai');
  });
});

describe('copy helpers', () => {
  it('pluralises counts', () => {
    expect(plural(1, 'check')).toBe('1 check');
    expect(plural(2, 'check')).toBe('2 checks');
  });

  it('ends sentences with one full stop', () => {
    expect(asSentence('At most 5 x plot area')).toBe('At most 5 x plot area.');
    expect(asSentence('Done.')).toBe('Done.');
  });
});

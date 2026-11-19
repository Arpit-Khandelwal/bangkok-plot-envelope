import { describe, expect, it } from 'vitest';
import { formatCorners, parseCorners } from './parseCorners';

const SQUARE = '13.68907, 100.60877\n13.68907, 100.60923\n13.68953, 100.60923\n13.68953, 100.60877';

describe('parseCorners', () => {
  it('reads latitude, longitude lines into longitude, latitude corners', () => {
    const result = parseCorners(SQUARE);
    expect(result).toEqual({
      ok: true,
      plot: [
        [100.60877, 13.68907],
        [100.60923, 13.68907],
        [100.60923, 13.68953],
        [100.60877, 13.68953],
      ],
    });
  });

  it('accepts longitude first by range', () => {
    const result = parseCorners('100.6, 13.7\n100.61, 13.7\n100.61, 13.71');
    expect(result).toEqual({
      ok: true,
      plot: [
        [100.6, 13.7],
        [100.61, 13.7],
        [100.61, 13.71],
      ],
    });
  });

  it('tolerates blank lines, trailing spaces, tabs, and space or comma separators', () => {
    const result = parseCorners('\n13.7 100.6  \n\n13.7\t100.61\r\n 13.71,100.61 \n');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plot).toHaveLength(3);
  });

  it('drops a final corner that repeats the first', () => {
    const result = parseCorners(`${SQUARE}\n13.68907, 100.60877`);
    expect(result.ok && result.plot.length).toBe(4);
  });

  it('rejects fewer than 3 corners', () => {
    const result = parseCorners('13.7, 100.6\n13.7, 100.61');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/at least 3/);
  });

  it('rejects more than 200 corners', () => {
    const many = Array.from({ length: 201 }, (_, i) => `13.7, ${(100.3 + i * 0.001).toFixed(3)}`).join('\n');
    const result = parseCorners(many);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/at most 200/);
  });

  it('names the first line that is outside the Bangkok box, counting blank lines', () => {
    const result = parseCorners('13.7, 100.6\n\n51.5, -0.12\n13.7, 100.62');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/^Line 3 is outside Bangkok/);
  });

  it('names the first garbage line', () => {
    const result = parseCorners('13.7, 100.6\nhello world\n13.7, 100.62');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/^Line 2 is not a pair of numbers/);
  });

  it('rejects lines with a third value and non-finite numbers', () => {
    expect(parseCorners('13.7, 100.6, 5\n13.7, 100.61\n13.71, 100.61').ok).toBe(false);
    expect(parseCorners('13.7, Infinity\n13.7, 100.61\n13.71, 100.61').ok).toBe(false);
    expect(parseCorners('13.7, 1e2\n13.7, 100.61\n13.71, 100.61').ok).toBe(false);
  });
});

describe('formatCorners', () => {
  it('writes latitude, longitude to 6 decimals and round-trips through the parser', () => {
    const parsed = parseCorners(SQUARE);
    if (!parsed.ok) throw new Error('expected valid corners');
    const text = formatCorners(parsed.plot);
    expect(text.split('\n')[0]).toBe('13.689070, 100.608770');
    expect(parseCorners(text)).toEqual(parsed);
  });
});

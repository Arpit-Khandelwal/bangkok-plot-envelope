import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import { m, m2Vs, mVs } from './format';

/** The number in a displayed string such as "12,500.4 m²" or "22.99 m". */
function parse(text: string): number {
  const match = /-?[\d,]+(\.\d+)?/.exec(text);
  if (match === null) throw new Error(`no number in ${text}`);
  return Number(match[0].replace(/,/g, ''));
}

describe('numbers compared with a limit', () => {
  it('rounds a value toward the side of the limit it is on', () => {
    expect(mVs(22.998, 23)).toEqual({ value: '22.99 m', limit: '23 m' });
    expect(mVs(500.01, 500).value).toBe('500.01 m');
    expect(mVs(499.99, 500).value).toBe('499.99 m');
    expect(mVs(500.004, 500).value).toBe('500.01 m');
    expect(mVs(499.9999, 500).value).toBe('499.99 m');
    expect(m2Vs(1000.4, 1000).value).toBe('1,000.4 m²');
    expect(m2Vs(9999.6, 10_000).value).toBe('9,999.6 m²');
  });

  it('rounds normally away from a limit and shows an exact match as equal', () => {
    expect(mVs(24.236, 23).value).toBe('24.24 m');
    expect(mVs(23, 23)).toEqual({ value: '23 m', limit: '23 m' });
    expect(m2Vs(8_123.6, 10_000).value).toBe('8,124 m²');
  });

  it('gives the limit enough decimals to show a difference from the value', () => {
    const pair = m2Vs(12_345.9, 12_345.67);
    expect(parse(pair.value)).toBeGreaterThan(parse(pair.limit));
  });

  it('never puts a value within 0.05 of a limit on the wrong side (property)', () => {
    const limits = [6, 12, 23, 500, 1000, 10_000, 12_345.67];
    for (const limit of limits) {
      for (let k = -500; k <= 500; k++) {
        const value = limit + k * 0.0001 + (k % 7) * 1e-7;
        for (const pair of [mVs(value, limit), m2Vs(value, limit)]) {
          const shown = parse(pair.value);
          const bound = parse(pair.limit);
          const side = Math.sign(value - limit);
          if (side === 0) {
            expect(shown).toBe(bound);
          } else {
            expect(Math.sign(shown - limit)).toBe(side);
            expect(Math.sign(shown - bound)).toBe(side);
          }
        }
      }
    }
  });

  it('keeps plain lengths as they were', () => {
    expect(m(22.998)).toBe('23 m');
  });
});

describe('displayed numbers agree with the verdict', () => {
  // The reproduction was floorToFloorM 2.83257 (roof deck 22.998 m). Sizing parking to the
  // requirement changed that stack, so 2.85653 m is used to land the deck at 22.999 m again.
  it.each([2.83257, 2.85653])('never shows a passing roof deck at 23 m (floor to floor %s m)', (floorToFloorM) => {
    const e = expectOk(evaluate(scenario(rect(40, 40), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], { floorToFloorM })));
    const checks = e.designs.flatMap((d) => d.checks).filter((c) => c.title === 'Roof deck under the high-rise height');
    expect(checks.length).toBeGreaterThan(0);
    for (const c of checks) {
      expect(c.status).toBe('pass');
      expect(parse(c.actual)).toBeLessThan(23);
    }
    for (const d of e.designs.filter((x) => x.regime === 'lowRise')) expect(d.summary).not.toMatch(/roof deck at 23 m/);
  });

  it('shows a 22.999 m roof deck as 22.99 m', () => {
    const e = expectOk(evaluate(scenario(rect(40, 40), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], { floorToFloorM: 2.85653 })));
    const low = designById(e, 'low-rise-block');
    expect(low.totals.roofDeckHeightM).toBeCloseTo(22.999, 6);
    const deck = low.checks.find((c) => c.title === 'Roof deck under the high-rise height');
    expect(deck?.actual).toContain('Roof deck at 22.99 m');
    expect(low.summary).toContain('roof deck at 22.99 m');
  });

  it.each([
    [499.99, '499.99 m', 'within'],
    [500.01, '500.01 m', 'beyond'],
  ])('shows a station %s m away as %s, %s 500 m', (d, shown, verdict) => {
    const e = expectOk(evaluate(scenario(rect(60, 60), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR], { stationDistanceM: d })));
    const basis = e.regimes.highRise.rules.rules.find((r) => r.id === 'plan.use-size')?.basis ?? '';
    expect(basis).toContain(`${shown} away, ${verdict} 500 m`);
    const warns = e.designs.flatMap((x) => x.checks).filter((c) => c.ruleId === 'plan.use-size' && c.status === 'warn');
    expect(warns.length).toBeGreaterThan(0);
    for (const c of warns) {
      expect(c.actual).toContain(shown);
      expect(c.actual).not.toMatch(/ 500 m,/);
    }
  });
});

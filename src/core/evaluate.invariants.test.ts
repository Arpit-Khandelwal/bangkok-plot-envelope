/** Properties every evaluation must have, over a fixed family of 30 plots and the eight example plots. */
import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate';
import { minWidthFor } from './designs/habitable';
import { difference, openRegion, regionArea } from './geom';
import { presetPlots } from './pipeline/preset-plots';
import { testPlots } from './pipeline/test-plots';
import type { Evaluation } from './types';

const OUTSIDE_TOLERANCE_M2 = 0.05;
/** Opening a habitable floor outline again may remove at most this much (grid rounding). */
const NARROW_TOLERANCE_M2 = 0.5;
const SUM_TOLERANCE = 1e-6;
const MAX_SPARE_STALLS = 2;

/** Every number reachable from the value, typed arrays included. */
function nonFiniteNumbers(value: unknown, path = '$'): string[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [path];
  if (value instanceof Float32Array || value instanceof Uint32Array) {
    return Array.from(value).some((v) => !Number.isFinite(v)) ? [path] : [];
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => nonFiniteNumbers(v, `${path}[${i}]`));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => nonFiniteNumbers(v, `${path}.${k}`));
  }
  return [];
}

const PLOTS = [...testPlots(), ...presetPlots().map((p) => ({ name: `preset ${p.id}`, scenario: p.scenario }))];
const RESULTS: ReadonlyArray<{ readonly name: string; readonly result: Evaluation }> = PLOTS.map((p) => ({
  name: p.name,
  result: evaluate(p.scenario),
}));

describe('invariants over 30 plots and the example plots', () => {
  it('has at least 30 plots', () => {
    expect(PLOTS.length).toBeGreaterThanOrEqual(30);
  });

  it.each(RESULTS)('$name: every number is finite', ({ result }) => {
    expect(nonFiniteNumbers(result)).toEqual([]);
  });

  it.each(RESULTS)('$name: totals are sums over the floors', ({ result }) => {
    if (!result.ok) return;
    for (const d of result.designs) {
      const t = d.totals;
      const sum = d.floors.reduce((s, f) => s + f.areaM2, 0);
      expect(Math.abs(t.grossFloorAreaM2 - sum)).toBeLessThan(SUM_TOLERANCE);
      expect(t.parkingFloorAreaM2 + t.mainUseFloorAreaM2).toBe(t.grossFloorAreaM2);
      expect(t.far).toBe(t.farFloorAreaM2 / result.site.areaM2);
      // A shared level is two entries (parking and main use), so storeys count distinct levels.
      expect(t.storeys).toBe(new Set(d.floors.map((f) => f.level)).size);
    }
  });

  it.each(RESULTS)('$name: every design passes its own checks', ({ result }) => {
    if (!result.ok) return;
    for (const d of result.designs) {
      expect(d.checks.filter((c) => c.status === 'fail').map((c) => `${d.id}: ${c.title}: ${c.actual}`)).toEqual([]);
      expect(d.passes).toBe(true);
    }
  });

  it.each(RESULTS)('$name: floors stay inside the envelope footprint', ({ result }) => {
    if (!result.ok) return;
    for (const d of result.designs) {
      const footprint = result.regimes[d.regime].envelope?.footprint ?? [];
      for (const f of d.floors) expect(regionArea(difference(f.outline, footprint))).toBeLessThan(OUTSIDE_TOLERANCE_M2);
    }
  });

  it.each(RESULTS)('$name: at least two designs whenever a regime has an envelope', ({ name, result }) => {
    if (!result.ok) return;
    const hasEnvelope = result.regimes.lowRise.envelope !== null || result.regimes.highRise.envelope !== null;
    if (!hasEnvelope) return;
    if (result.designs.length >= 2) return;
    // Only a plot too small to park one car on its plate, or too narrow for a usable floor, may
    // fall short, and it must say so.
    const problem = result.problems.find((p) => p.code === 'no-design');
    expect(problem).toBeDefined();
    if (name.includes('150 m²')) return;
    expect(result.designs).toEqual([]);
    expect(problem?.message).toMatch(/^The buildable part of this plot is only about [\d.]+ m wide after setbacks, too narrow for a usable floor/);
    expect(problem?.blocking).toBe(false);
  });

  it.each(RESULTS)('$name: no floor outline has a part narrower than a usable floor', ({ result }) => {
    if (!result.ok) return;
    for (const d of result.designs) {
      for (const f of d.floors) {
        const lost = regionArea(f.outline) - regionArea(openRegion(f.outline, minWidthFor(f.use)));
        expect(lost, `${d.id} level ${f.level} ${f.use}`).toBeLessThan(NARROW_TOLERANCE_M2);
      }
    }
  });

  // At most two spare: on the small plates the fire road and the front open space now leave, the
  // smallest parking piece that can be cut (about 48 m², nearly two stalls) can overshoot by two.
  it.each(RESULTS)('$name: parking provides the required stalls and at most two more', ({ result }) => {
    if (!result.ok) return;
    for (const d of result.designs) {
      expect(d.totals.parkingProvided).toBeGreaterThanOrEqual(d.totals.parkingRequired);
      expect(d.totals.parkingProvided - d.totals.parkingRequired).toBeLessThanOrEqual(MAX_SPARE_STALLS);
    }
  });

  it.each(RESULTS)('$name: floors are contiguous in height', ({ result }) => {
    if (!result.ok) return;
    for (const d of result.designs) {
      // Levels run 1, 2, 3 ... with no gap; the entries of a shared level share their heights.
      const levels = [...new Set(d.floors.map((f) => f.level))];
      expect(levels).toEqual(levels.map((_, i) => i + 1));
      levels.forEach((level, i) => {
        const entries = d.floors.filter((f) => f.level === level);
        const below = d.floors.filter((f) => f.level === level - 1);
        for (const f of entries) {
          expect(f.baseM).toBe(i === 0 ? 0 : below[0]?.topM);
          expect(f.topM).toBe(entries[0]?.topM);
          expect(f.topM).toBeGreaterThan(f.baseM);
        }
      });
    }
  });

  it.each(PLOTS)('$name: no failing candidate is hidden by the pass filter', ({ scenario: s }) => {
    // A rule id that matches nothing: every rule stays on, but `hypothetical` keeps failing designs.
    const probe = evaluate({ ...s, disabledRuleIds: ['__no-such-rule__'] });
    const normal = evaluate(s);
    if (!probe.ok || !normal.ok) return;
    const failing = probe.designs.flatMap((d) => d.checks.filter((c) => c.status === 'fail').map((c) => `${d.id}: ${c.title}: ${c.actual}`));
    expect(failing).toEqual([]);
    expect(probe.designs.map((d) => d.id)).toEqual(normal.designs.map((d) => d.id));
  });

  it('is deterministic: the same input gives a deep-equal output', () => {
    for (const plot of PLOTS.slice(0, 8)) expect(evaluate(plot.scenario)).toEqual(evaluate(plot.scenario));
  });
});

/**
 * A design is never offered as passing beside its own evidence of a problem. The rule, over every
 * example plot and the deterministic invariant plots:
 *  1. `passes` is true exactly when no check has status `fail`;
 *  2. with every rule on, every design offered passes;
 *  3. the check on whether the fire road and the planting fit together is only ever pass or fail;
 *  4. a passing design carries a warning only from a rule on this list, each of which is a known
 *     "check on site" the tool cannot settle: the onward road network, the station distance near
 *     its limit, and a floor height raised to the legal minimum. Any new warning must be added here deliberately, so a shortfall cannot
 *     slip through as a warning.
 */
import { describe, expect, it } from 'vitest';
import { FIRE_PLANTING_TITLE } from './checks/fire-planting';
import { evaluate } from './evaluate';
import { presetPlots } from './pipeline/preset-plots';
import { testPlots } from './pipeline/test-plots';

const WARN_ALLOWED: ReadonlySet<string> = new Set(['mr33.access-road', 'plan.use-size', 'mr55.floor-height']);

const PLOTS = [...testPlots(), ...presetPlots().map((p) => ({ name: `preset ${p.id}`, scenario: p.scenario }))];

describe('no passing design beside its own evidence of a problem', () => {
  it.each(PLOTS)('$name', ({ scenario }) => {
    const e = evaluate(scenario);
    if (!e.ok) return;
    for (const d of e.designs) {
      const failing = d.checks.filter((c) => c.status === 'fail');
      expect(d.passes).toBe(failing.length === 0);
      if (!e.hypothetical) expect(d.passes, d.id).toBe(true);
      for (const c of d.checks.filter((x) => x.title === FIRE_PLANTING_TITLE)) expect(['pass', 'fail']).toContain(c.status);
      if (!d.passes) continue;
      const stray = d.checks.filter((c) => c.status === 'warn' && !WARN_ALLOWED.has(c.ruleId)).map((c) => `${d.id}: ${c.ruleId}`);
      expect(stray).toEqual([]);
    }
  });
});

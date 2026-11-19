import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { saneAssumptions } from './assumptions';
import { expectOk, NEIGHBOUR, rect, road, scenario } from './test-scenarios';

const BASE = scenario(rect(50, 50), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]).assumptions;

describe('assumption sanity minimums', () => {
  it('raises parking area per stall to at least 20 m², saying so', () => {
    const out = saneAssumptions({ ...BASE, parkingM2PerStall: 12 });
    expect(out.assumptions.parkingM2PerStall).toBe(20);
    expect(out.problems).toHaveLength(1);
    const [p] = out.problems;
    expect(p?.code).toBe('assumption-adjusted');
    expect(p?.blocking).toBe(false);
    expect(p?.message).toContain('Parking floor area per car');
    expect(p?.message).toContain('12');
    expect(p?.message).toContain('20');
  });

  it('raises parking floor-to-floor to at least 2.4 m, saying so', () => {
    const out = saneAssumptions({ ...BASE, parkingFloorToFloorM: 2.1 });
    expect(out.assumptions.parkingFloorToFloorM).toBe(2.4);
    expect(out.problems[0]?.message).toMatch(/2\.1 .*2\.4/);
  });

  it('reports a blank (non-finite) value replaced by its default', () => {
    const out = saneAssumptions({ ...BASE, efficiency: Number.NaN });
    expect(out.assumptions.efficiency).toBe(0.7);
    expect(out.problems[0]?.message).toContain('blank');
  });

  it('adds no problem for values inside their ranges', () => {
    expect(saneAssumptions(BASE).problems).toEqual([]);
    expect(saneAssumptions(BASE).assumptions).toEqual(BASE);
  });

  it('shows every clamp as a non-blocking problem of the evaluation', () => {
    const s = scenario(rect(50, 50), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]);
    const e = expectOk(evaluate({ ...s, assumptions: { ...s.assumptions, parkingM2PerStall: 5, parkingFloorToFloorM: 1 } }));
    const adjusted = e.problems.filter((p) => p.code === 'assumption-adjusted');
    expect(adjusted).toHaveLength(2);
    expect(adjusted.every((p) => !p.blocking)).toBe(true);
    for (const d of e.designs) {
      const parkingFloors = d.floors.filter((f) => f.use === 'parking');
      for (const f of parkingFloors) expect(f.topM - f.baseM).toBeGreaterThanOrEqual(2.4 - 1e-9);
    }
  });
});

/** One quantity, one wording: floor areas against limits, FAR, the parking sentence, EIA and headroom. */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate';
import { shrinkUniform } from '../geom';
import { presetPlots } from '../pipeline/preset-plots';
import { designById, expectOk, NEIGHBOUR, rect, road, scenario } from '../pipeline/test-scenarios';
import { formatNumber } from '../rules/format';
import { buildingChecks } from './building';
import { measure } from './context';
import { checkInputFor, floorsOf } from './test-input';

function preset(id: string) {
  const found = presetPlots().find((p) => p.id === id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  return found.scenario;
}

describe('a design states its floor area one way', () => {
  const e = expectOk(evaluate(preset('sukhumvit-wide-frontage')));
  const d = designById(e, 'high-rise-max');
  const areaChecks = d.checks.filter((c) => c.ruleId === 'plan.far' || c.ruleId === 'mr33.far-10');

  it('shows the same one-decimal total in every floor-area check', () => {
    const shown = areaChecks.map((c) => /^([\d,]+\.\d) m²/.exec(c.actual)?.[1]);
    expect(shown.length).toBe(2);
    expect(new Set(shown).size).toBe(1);
    expect(shown[0]).toMatch(/^\d{2},\d{3}\.\d$/);
  });

  it('shows FAR as the design figures do, never one below beside the other', () => {
    const far = d.checks.find((c) => c.ruleId === 'plan.far');
    expect(far?.actual).toContain(`(FAR ${formatNumber(d.totals.far, 2)})`);
  });

  it('never shows the area over its limit when it is under', () => {
    for (const c of areaChecks) {
      const value = Number(/^([\d,.]+) m²/.exec(c.actual)?.[1]?.replace(/,/g, ''));
      const limit = Number(/at most ([\d,.]+) m²/.exec(c.required)?.[1]?.replace(/,/g, ''));
      expect(value).toBeLessThanOrEqual(limit);
    }
  });
});

describe('the office parking sentence', () => {
  it('has no dangling "whichever is more" when there is one rate', () => {
    const e = expectOk(evaluate(preset('office-16m-road')));
    for (const d of e.designs) {
      const c = d.checks.find((x) => x.ruleId === 'bma.parking' && x.title !== 'Parking clear height');
      expect(c?.required).not.toMatch(/whichever is more/);
      expect(c?.required).toMatch(/of main-use floor area \([\d,]+ m²\)\.$/);
    }
  });

  it('keeps "whichever is more" for a condo with two rates', () => {
    const e = expectOk(evaluate(preset('sukhumvit-wide-frontage')));
    const c = e.designs[0]?.checks.find((x) => x.ruleId === 'bma.parking' && x.title !== 'Parking clear height');
    expect(c?.required).toMatch(/, whichever is more\.$/);
  });
});

describe('parking clear height (MR 41)', () => {
  it('states the assumed parking storey and the 2.10 m clear height for a design with parking', () => {
    const e = expectOk(evaluate(preset('sukhumvit-wide-frontage')));
    for (const d of e.designs) {
      const c = d.checks.find((x) => x.title === 'Parking clear height');
      expect(c?.status).toBe('info');
      expect(c?.actual).toMatch(/assumed 3 m floor to floor; the 2\.1 m clear under beams must be achieved/);
    }
  });
});

describe('EIA threshold on the total floor area', () => {
  it('reports an EIA for 5,000 m² of main use at 70% efficiency in 100 m² units', () => {
    // Before, 5,000 x 0.7 = 3,500 m² of sellable area and 35 units: no EIA. The stricter measure,
    // total floor area, is over 4,000 m².
    const base = scenario(rect(60, 60), [road(12), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]);
    const s = { ...base, assumptions: { ...base.assumptions, efficiency: 0.7, averageUnitM2: 100 } };
    const site = expectOk(evaluate(s)).site;
    const plate = shrinkUniform([{ outer: site.ring, holes: [] }], 5);
    const input = checkInputFor(s, 'lowRise', floorsOf(plate, 1).map((f) => ({ ...f, areaM2: 5000 })));
    const scaled = { ...input, floors: floorsOf(plate, 1) };
    const m = measure(scaled.floors);
    const measured = { ...m, sums: { gross: 5000, parking: 0, main: 5000 } };
    const eia = buildingChecks(scaled, measured).find((c) => c.ruleId === 'eia.threshold');
    expect(eia?.actual).toMatch(/an EIA is needed/);
    expect(eia?.actual).toMatch(/5,000\.0 m² of total floor area/);
    expect(eia?.required).toMatch(/total floor area of the building, the strictest measure, until its definition is confirmed/);
  });
});

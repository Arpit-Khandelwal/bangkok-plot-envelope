import { describe, expect, it } from 'vitest';
import { sampleEvaluation } from '../fixtures/sampleEvaluation';
import { buildModel, GLASS_COLOUR, resolveDesign, USE_COLOURS } from './buildModel';

describe('buildModel', () => {
  it('returns nothing without a successful evaluation', () => {
    expect(buildModel(null, null)).toBeNull();
    expect(buildModel({ ok: false, problems: [], site: null }, null)).toBeNull();
  });

  it('draws the selected design as glass, ghost and solid parts', () => {
    const model = buildModel(sampleEvaluation, 'tower-on-podium');
    expect(model?.origin).toEqual(sampleEvaluation.site.frame.origin);
    const looks = model?.parts.map((part) => [part.key, part.look, part.color]);
    expect(looks).toEqual([
      ['envelope-highRise', 'glass', GLASS_COLOUR],
      ['envelope-lowRise', 'ghost', GLASS_COLOUR],
      ['tower-on-podium-parking-0', 'solid', USE_COLOURS.parking],
      ['tower-on-podium-residential-1', 'solid', USE_COLOURS.residential],
    ]);
  });

  it('falls back to the first design when the selection is stale', () => {
    expect(resolveDesign(sampleEvaluation, 'gone')?.id).toBe('low-rise-block');
    expect(buildModel(sampleEvaluation, null)?.parts[0]?.key).toBe('envelope-lowRise');
  });

  it('leaves out an envelope that does not exist', () => {
    const evaluation = {
      ...sampleEvaluation,
      regimes: { ...sampleEvaluation.regimes, highRise: { ...sampleEvaluation.regimes.highRise, envelope: null } },
    };
    const keys = buildModel(evaluation, 'low-rise-block')?.parts.map((part) => part.key);
    expect(keys).toEqual(['envelope-lowRise', 'low-rise-block-parking-0', 'low-rise-block-residential-1']);
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Design } from '../../core/types';
import { sampleEvaluation } from '../fixtures/sampleEvaluation';
import { DesignFigures, spaceShareSentences } from './DesignFigures';
import { Results } from './Results';

afterEach(cleanup);

const [first] = sampleEvaluation.designs;
if (!first) throw new Error('The sample evaluation needs a design');
const regime = sampleEvaluation.regimes[first.regime].rules;

function withTotals(totals: Partial<Design['totals']>): Design {
  return { ...first as Design, totals: { ...(first as Design).totals, ...totals } };
}

describe('DesignFigures', () => {
  it('shows counted and total floor area separately when they differ', () => {
    render(<DesignFigures design={withTotals({ farFloorAreaM2: 12000, grossFloorAreaM2: 16832 })} regime={regime} plotAreaM2={2500} />);
    expect(screen.getByText('Floor area counted toward FAR')).toBeTruthy();
    expect(screen.getByText('12,000 m²')).toBeTruthy();
    expect(screen.getByText(/Total floor area built: 16,832 m²/)).toBeTruthy();
  });

  it('shows one line when the two are equal', () => {
    render(<DesignFigures design={withTotals({ farFloorAreaM2: 9450, grossFloorAreaM2: 9450 })} regime={regime} plotAreaM2={2500} />);
    expect(screen.getByText('Floor area')).toBeTruthy();
    expect(screen.queryByText(/Total floor area built/)).toBeNull();
  });

  it('says how much of the allowed space the design fills', () => {
    render(<DesignFigures design={withTotals({ envelopeVolumeShare: 0.58 })} regime={regime} plotAreaM2={2500} />);
    expect(screen.getByText(/This design fills 58% of the allowed space\. The allowed space is larger/)).toBeTruthy();
  });
});

describe('spaceShareSentences', () => {
  it('handles 0, 60 percent and values above 1', () => {
    expect(spaceShareSentences(0)).toContain('fills 0% of the allowed space.');
    expect(spaceShareSentences(0.6)).toBe('This design fills 60% of the allowed space.');
    expect(spaceShareSentences(1.04)).toBe('This design fills 100% of the allowed space.');
  });
});

describe('Results without designs', () => {
  it('shows the problems and a direction instead of a design', () => {
    const evaluation = {
      ...sampleEvaluation,
      designs: [],
      problems: [{ code: 'no-design' as const, message: 'Fewer than two designs fit.', blocking: false }],
    };
    render(<Results evaluation={evaluation} design={null} />);
    expect(screen.getByText('Fewer than two designs fit.')).toBeTruthy();
    expect(screen.getByText('No design fits on this plot under the current rules. Try a larger plot or a wider road.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Concept designs' })).toBeNull();
  });
});

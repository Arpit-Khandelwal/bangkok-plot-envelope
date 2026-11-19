// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EdgeSpec } from '../../core/types';
import type { ZoneLookup } from '../../site/context';
import { useAppStore } from '../../state/store';
import type { EvaluationView } from '../../state/useEvaluation';
import { sampleEvaluation } from '../fixtures/sampleEvaluation';
import { resetStore, SAMPLE_EDGES, SAMPLE_PLOT } from '../testing/storeReset';
import { Panel } from './Panel';

const IN_ZONE: ZoneLookup = { status: 'single', zone: { code: 'ย.7', planVersion: '2556' } };

function view(overrides: Partial<EvaluationView> = {}): EvaluationView {
  return {
    evaluation: sampleEvaluation,
    zoneLookup: IN_ZONE,
    station: { name: 'Punnawithi', ref: 'E12', distanceM: 380, geomSource: 'node' },
    dataStatus: { state: 'ready' },
    ...overrides,
  };
}

beforeEach(() => resetStore({ plot: SAMPLE_PLOT, edges: SAMPLE_EDGES }));
afterEach(cleanup);

describe('Panel', () => {
  it('gives directions before a plot is drawn', () => {
    resetStore();
    render(<Panel view={view({ evaluation: null, zoneLookup: null })} design={null} mapError={null} />);
    expect(screen.getByText('Click on the map to place the corners of your plot.')).toBeTruthy();
  });

  it('shows the plot in square metres and Thai land units, and the station as approximate', () => {
    render(<Panel view={view()} design={sampleEvaluation.designs[0] ?? null} mapError={null} />);
    expect(screen.getByText('2,500 m²')).toBeTruthy();
    expect(screen.getByText('1 rai 2 ngan 25 sq wah')).toBeTruthy();
    expect(screen.getByText('Punnawithi (E12), approximately 380 m')).toBeTruthy();
  });

  it('renders the results for the selected design', () => {
    render(<Panel view={view()} design={sampleEvaluation.designs[1] ?? null} mapError={null} />);
    expect(screen.getByRole('heading', { name: 'Concept designs' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Section through the plot/ })).toBeTruthy();
    expect(screen.getByText(/is what stops more floor area/)).toBeTruthy();
  });

  it('explains when the plot is outside zone ย.7 and gives no verdict', () => {
    const outside: EvaluationView = view({
      zoneLookup: { status: 'outside' },
      evaluation: {
        ok: false,
        site: null,
        problems: [{ code: 'outside-zone', message: 'Outside any zone.', blocking: true }],
      },
    });
    render(<Panel view={outside} design={null} mapError={null} />);
    expect(screen.getByRole('heading', { name: 'No verdict for this plot' })).toBeTruthy();
    expect(screen.getByText(/covers zone/).textContent).toContain('ย.7 only');
    expect(screen.queryByText('Outside any zone.')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Concept designs' })).toBeNull();
  });

  it('names the zones a straddling plot touches', () => {
    const straddles = view({
      zoneLookup: { status: 'straddles', zones: [{ code: 'ย.6', planVersion: '2556' }, { code: 'ย.7', planVersion: '2556' }] },
    });
    render(<Panel view={straddles} design={null} mapError={null} />);
    expect(screen.getByText('This plot crosses a zone boundary: it touches ย.6 and ย.7.')).toBeTruthy();
  });

  it('shows blocking problems in place of results', () => {
    const blocked = view({
      evaluation: { ok: false, site: null, problems: [{ code: 'self-intersecting', message: 'The outline crosses itself. Move a corner.', blocking: true }] },
    });
    render(<Panel view={blocked} design={null} mapError={null} />);
    expect(screen.getByRole('alert').textContent).toBe('The outline crosses itself. Move a corner.');
  });

  it('opens assumptions as a collapsed section', async () => {
    const user = userEvent.setup();
    render(<Panel view={view()} design={sampleEvaluation.designs[0] ?? null} mapError={null} />);
    const details = screen.getByText('Assumptions (not law)').closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await user.click(screen.getByText('Assumptions (not law)'));
    const field = within(details).getByLabelText('Average unit size');
    await user.clear(field);
    await user.type(field, '45');
    await user.tab();
    expect(useAppStore.getState().assumptions.averageUnitM2).toBe(45);
  });

  it('shows the road prompt once, not again as a problem', () => {
    resetStore({ plot: SAMPLE_PLOT, edges: SAMPLE_EDGES.map((): EdgeSpec => ({ kind: 'neighbour' })) });
    const message = 'Mark the edge that faces the road. Setbacks and the height limit are measured from it.';
    const noRoad: EvaluationView = view({
      evaluation: { ok: false, site: null, problems: [{ code: 'no-road', message, blocking: true }] },
    });
    render(<Panel view={noRoad} design={null} mapError={null} />);
    expect(screen.getAllByText(message)).toHaveLength(1);
  });

  it('drops the road prompt when the plot is outside the covered zone', () => {
    resetStore({ plot: SAMPLE_PLOT, edges: SAMPLE_EDGES.map((): EdgeSpec => ({ kind: 'neighbour' })) });
    const message = 'Mark the edge that faces the road. Setbacks and the height limit are measured from it.';
    const outside: EvaluationView = view({
      zoneLookup: { status: 'outside' },
      evaluation: { ok: false, site: null, problems: [{ code: 'no-road', message, blocking: true }] },
    });
    render(<Panel view={outside} design={null} mapError={null} />);
    expect(screen.getByRole('heading', { name: 'No verdict for this plot' })).toBeTruthy();
    expect(screen.queryByText(message)).toBeNull();
  });

  it('scrolls back to the top when an example is loaded, but not on ordinary edits', () => {
    const { container } = render(<Panel view={view()} design={sampleEvaluation.designs[0] ?? null} mapError={null} />);
    const panel = container.querySelector('.panel') as HTMLElement;
    panel.scrollTop = 120;
    act(() => useAppStore.getState().selectEdge(1));
    expect(panel.scrollTop).toBe(120);
    act(() => useAppStore.setState({ plotRevision: useAppStore.getState().plotRevision + 1 }));
    expect(panel.scrollTop).toBe(0);
  });
});

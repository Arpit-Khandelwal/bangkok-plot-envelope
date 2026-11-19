// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NumberField } from './common/NumberField';
import { sampleEvaluation } from './fixtures/sampleEvaluation';
import { Legend } from './legend/Legend';
import { EdgeList } from './plot/EdgeList';
import { AreaSchedule } from './results/AreaSchedule';
import { DesignSwitcher } from './results/DesignSwitcher';
import { resetStore, SAMPLE_EDGES, SAMPLE_PLOT } from './testing/storeReset';
import { useAppStore } from '../state/store';

afterEach(cleanup);

describe('EdgeRow selection', () => {
  beforeEach(() => resetStore({ plot: SAMPLE_PLOT, edges: SAMPLE_EDGES }));

  it('does not select an edge when focus merely enters its row', async () => {
    const user = userEvent.setup();
    render(<EdgeList edgeLengthsM={[50, 50, 50, 50]} />);
    await user.tab();
    await user.tab();
    expect(useAppStore.getState().selectedEdge).toBeNull();
  });

  it('selects the edge when the user changes a value in its row', async () => {
    const user = userEvent.setup();
    render(<EdgeList edgeLengthsM={[50, 50, 50, 50]} />);
    await user.click(screen.getAllByLabelText('Neighbour')[1] as HTMLElement);
    expect(useAppStore.getState().selectedEdge).toBe(1);
  });
});

describe('NumberField', () => {
  it('describes the input with its unit', () => {
    render(<NumberField label="Height" unit="m" value={3} min={1} max={9} onCommit={() => undefined} />);
    const input = screen.getByLabelText('Height');
    const unit = screen.getByText('m');
    expect(input.getAttribute('aria-describedby')).toContain(unit.id);
  });
});

describe('Thai text and scroll regions', () => {
  it('marks the zone code in the legend as Thai', () => {
    const { container } = render(<Legend />);
    expect(container.querySelector('[lang="th"]')?.textContent).toBe('ย.7');
  });

  it('gives the design table a hidden corner header and a focusable scroll region', () => {
    render(<DesignSwitcher designs={sampleEvaluation.designs} selectedId={sampleEvaluation.designs[0]?.id ?? ''} />);
    expect(screen.getByRole('columnheader', { name: 'Measure' })).toBeTruthy();
    const region = screen.getByRole('region', { name: 'Concept designs, scrolls sideways' });
    expect(region.getAttribute('tabindex')).toBe('0');
  });

  it('gives the area schedule a focusable scroll region', () => {
    const design = sampleEvaluation.designs[0];
    if (!design) throw new Error('fixture');
    render(<AreaSchedule design={design} />);
    expect(screen.getByRole('region', { name: 'Area schedule, scrolls sideways' }).getAttribute('tabindex')).toBe('0');
  });
});

describe('stylesheet commitments', () => {
  const global = readFileSync(resolve(__dirname, '../styles/global.css'), 'utf8');

  it('keeps a transparent outline on focus, and redraws controls in forced colours', () => {
    expect(global).toContain('outline: 2px solid transparent');
    expect(global).toContain('@media (forced-colors: active)');
    expect(global).toContain('CanvasText');
    expect(global).toContain('Highlight');
  });

  it('pads scrolling by the pinned map height and frees the map on short screens', () => {
    expect(global).toContain('scroll-padding-top: calc(var(--stage-height) + 8px)');
    expect(global).toContain('clamp(160px, 42dvh, 420px)');
    expect(global).toContain('(max-height: 480px)');
  });
});

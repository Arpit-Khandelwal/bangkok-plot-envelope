// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EdgeSpec } from '../../core/types';
import { useAppStore } from '../../state/store';
import { resetStore, SAMPLE_EDGES, SAMPLE_PLOT } from '../testing/storeReset';
import { EdgeList } from './EdgeList';

const LENGTHS = [50, 50, 50, 50];

beforeEach(() => resetStore({ plot: SAMPLE_PLOT, edges: SAMPLE_EDGES }));
afterEach(cleanup);

describe('EdgeList', () => {
  it('rejects a non-numeric road width and keeps the stored value', async () => {
    const user = userEvent.setup();
    render(<EdgeList edgeLengthsM={LENGTHS} />);
    const field = screen.getByLabelText('Road width (right of way)');
    await user.clear(field);
    await user.type(field, '12m');
    await user.tab();
    const error = document.querySelector('.number-field__error');
    expect(error?.getAttribute('aria-live')).toBe('polite');
    expect(error?.textContent).toContain('digits only');
    expect(field.getAttribute('aria-describedby')).toContain(error?.id ?? 'missing');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(useAppStore.getState().edges[0]).toEqual(SAMPLE_EDGES[0]);
  });

  it('rejects a road width out of range', async () => {
    const user = userEvent.setup();
    render(<EdgeList edgeLengthsM={LENGTHS} />);
    const field = screen.getByLabelText('Road width (right of way)');
    await user.clear(field);
    await user.type(field, '150');
    await user.tab();
    expect(document.querySelector('.number-field__error')?.textContent).toBe('Must be at most 100 m.');
    expect(useAppStore.getState().edges[0]).toEqual(SAMPLE_EDGES[0]);
  });

  it('stores a valid road width', async () => {
    const user = userEvent.setup();
    render(<EdgeList edgeLengthsM={LENGTHS} />);
    const field = screen.getByLabelText('Road width (right of way)');
    await user.clear(field);
    await user.type(field, '16.5{Enter}');
    expect(useAppStore.getState().edges[0]).toEqual({ kind: 'road', roadId: 'road-1', rowWidthM: 16.5 });
  });

  it('prompts for a road when no edge faces one', () => {
    resetStore({ plot: SAMPLE_PLOT, edges: SAMPLE_EDGES.map((): EdgeSpec => ({ kind: 'neighbour' })) });
    render(<EdgeList edgeLengthsM={LENGTHS} />);
    expect(screen.getByText('Mark the edge that faces the road. Setbacks and the height limit are measured from it.')).toBeTruthy();
  });

  it('hides the road prompt when told there is no verdict for the plot', () => {
    resetStore({ plot: SAMPLE_PLOT, edges: SAMPLE_EDGES.map((): EdgeSpec => ({ kind: 'neighbour' })) });
    render(<EdgeList edgeLengthsM={LENGTHS} showRoadPrompt={false} />);
    expect(screen.queryByText(/Mark the edge that faces the road/)).toBeNull();
  });

  it('makes a second road join the first and offers a different road', async () => {
    const user = userEvent.setup();
    render(<EdgeList edgeLengthsM={LENGTHS} />);
    const roadOptions = screen.getAllByRole('radio', { name: 'Road' });
    await user.click(roadOptions[1] as HTMLElement);
    expect(useAppStore.getState().edges[1]).toEqual({ kind: 'road', roadId: 'road-1', rowWidthM: 12 });
    expect(useAppStore.getState().selectedEdge).toBe(1);

    const choices = screen.getAllByLabelText('Which road');
    await user.selectOptions(choices[1] as HTMLElement, 'A different road');
    expect(useAppStore.getState().edges[1]).toEqual({ kind: 'road', roadId: 'road-2', rowWidthM: 12 });
  });

  it('selects an edge when its row is chosen', async () => {
    const user = userEvent.setup();
    render(<EdgeList edgeLengthsM={LENGTHS} />);
    await user.click(screen.getByRole('button', { name: /Edge C/ }));
    expect(useAppStore.getState().selectedEdge).toBe(2);
  });
});

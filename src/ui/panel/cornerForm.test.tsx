// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../state/store';
import { resetStore, SAMPLE_PLOT } from '../testing/storeReset';
import { EmptyState } from './EmptyState';
import { CornerForm } from './CornerForm';

beforeEach(() => resetStore());
afterEach(cleanup);

describe('empty state', () => {
  it('offers the no-mouse alternatives after the drawing steps', () => {
    render(<EmptyState />);
    expect(screen.getByText('No mouse? Choose an example plot, open a shared link, or enter the corner coordinates below.')).toBeTruthy();
    expect(screen.getByText('Enter corner coordinates')).toBeTruthy();
  });
});

describe('CornerForm', () => {
  it('loads valid corners through the store with every edge a neighbour', async () => {
    const user = userEvent.setup();
    render(<CornerForm />);
    const field = screen.getByLabelText('Corners');
    await user.click(field);
    await user.paste('13.68907, 100.60877\n13.68907, 100.60923\n13.68953, 100.60923');
    const revision = useAppStore.getState().plotRevision;
    await user.click(screen.getByRole('button', { name: 'Use these corners' }));
    const state = useAppStore.getState();
    expect(state.plot).toHaveLength(3);
    expect(state.plot?.[0]).toEqual([100.60877, 13.68907]);
    expect(state.edges.every((edge) => edge.kind === 'neighbour')).toBe(true);
    expect(state.plotRevision).toBe(revision + 1);
  });

  it('shows an inline error tied to the field and names the bad line', async () => {
    const user = userEvent.setup();
    render(<CornerForm />);
    const field = screen.getByLabelText('Corners');
    await user.click(field);
    await user.paste('13.68907, 100.60877\n51.5, -0.12\n13.68953, 100.60923');
    await user.click(screen.getByRole('button', { name: 'Use these corners' }));
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const message = screen.getByText(/^Line 2 is outside Bangkok/);
    expect(field.getAttribute('aria-describedby')).toContain(message.id);
    expect(useAppStore.getState().plot).toBeNull();
    expect(document.activeElement).toBe(field);
  });

  it('states the format with a real example line', () => {
    render(<CornerForm />);
    expect(screen.getByText(/13\.68930, 100\.60900/)).toBeTruthy();
  });

  it('pre-fills the current corners to 6 decimals when a plot exists', async () => {
    resetStore({ plot: SAMPLE_PLOT });
    render(<CornerForm />);
    expect(screen.getByText('Edit corner coordinates')).toBeTruthy();
    await waitFor(() => expect((screen.getByLabelText('Corners') as HTMLTextAreaElement).value.split('\n')[0]).toBe('13.689070, 100.608770'));
  });
});

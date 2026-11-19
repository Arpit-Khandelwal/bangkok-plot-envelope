// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../state/store';
import { resetStore } from '../testing/storeReset';
import { AssumptionsForm } from './AssumptionsForm';
import { readInterpretation } from './InterpretationSwitches';

beforeEach(() => resetStore());
afterEach(cleanup);

describe('interpretation switches', () => {
  it('lists three switches under one heading, each marked with its cautious position', () => {
    render(<AssumptionsForm />);
    expect(screen.getByRole('heading', { name: 'How unclear rules are read' })).toBeTruthy();
    expect(screen.getAllByRole('switch', { hidden: true })).toHaveLength(3);
    expect(screen.getAllByText('Stricter when on.')).toHaveLength(3);
  });

  it('turns the front open space switch on and off in the store', async () => {
    const user = userEvent.setup();
    render(<AssumptionsForm />);
    const toggle = screen.getByLabelText('Require a 12 m front open space even on a public road', { selector: 'input' });
    expect((toggle as HTMLInputElement).checked).toBe(false);
    await user.click(toggle);
    expect(readInterpretation(useAppStore.getState().interpretation, 'frontOpenSpaceOnPublicRoad')).toBe(true);
    await user.click(toggle);
    expect(readInterpretation(useAppStore.getState().interpretation, 'frontOpenSpaceOnPublicRoad')).toBe(false);
  });
});

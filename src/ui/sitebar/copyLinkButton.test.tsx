// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore, SAMPLE_EDGES, SAMPLE_PLOT } from '../testing/storeReset';
import { COPIED_MESSAGE_MS, CopyLinkButton } from './CopyLinkButton';

function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  resetStore({ plot: SAMPLE_PLOT, edges: SAMPLE_EDGES });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setClipboard(undefined);
});

describe('CopyLinkButton', () => {
  it('is disabled without a plot', () => {
    resetStore();
    render(<CopyLinkButton />);
    expect((screen.getByRole('button', { name: 'Copy link' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('copies the current link and shows Link copied for two seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<CopyLinkButton />);
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(window.location.href).toContain('#v1=');
    const region = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(region.textContent).toBe('Link copied');
    act(() => {
      vi.advanceTimersByTime(COPIED_MESSAGE_MS + 10);
    });
    expect(region.textContent).toBe('');
  });

  it('falls back to a selected read-only input when the clipboard rejects', async () => {
    const user = userEvent.setup();
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    document.execCommand = vi.fn().mockReturnValue(false);
    render(<CopyLinkButton />);
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    const input = (await screen.findByLabelText('Link to copy')) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe(window.location.href);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('counts a successful selection copy when the Clipboard API is missing', async () => {
    const user = userEvent.setup();
    setClipboard(undefined);
    document.execCommand = vi.fn().mockReturnValue(true);
    render(<CopyLinkButton />);
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect((document.querySelector('[aria-live="polite"]') as HTMLElement).textContent).toBe('Link copied');
  });
});

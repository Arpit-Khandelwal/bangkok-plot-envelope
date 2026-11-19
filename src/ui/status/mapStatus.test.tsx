// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapStatus } from './MapStatus';

afterEach(cleanup);

describe('MapStatus', () => {
  it('keeps a polite live region mounted while there is nothing to say', () => {
    render(<MapStatus message={null} onRetry={() => undefined} />);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');
  });

  it('shows the activity mark only while busy', () => {
    const { container, rerender } = render(<MapStatus message={{ text: 'Loading map', kind: 'busy' }} onRetry={() => undefined} />);
    expect(screen.getByRole('status').textContent).toBe('Loading map');
    expect(container.querySelector('.map-status__mark')).not.toBeNull();
    rerender(<MapStatus message={{ text: 'A note', kind: 'note' }} onRetry={() => undefined} />);
    expect(container.querySelector('.map-status__mark')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('announces a static text and shows the count in an aria-hidden sibling', () => {
    const { container } = render(
      <MapStatus message={{ text: 'Loading surrounding buildings', detail: '(3 of 11)', kind: 'busy' }} onRetry={() => undefined} />,
    );
    const detail = container.querySelector('.map-status__detail');
    expect(detail?.getAttribute('aria-hidden')).toBe('true');
    expect(detail?.textContent).toBe('(3 of 11)');
    expect(screen.getByText('Loading surrounding buildings').getAttribute('aria-hidden')).toBeNull();
  });

  it('offers "Try again" on an error', async () => {
    const onRetry = vi.fn();
    render(<MapStatus message={{ text: 'Surrounding buildings could not be loaded.', kind: 'error' }} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

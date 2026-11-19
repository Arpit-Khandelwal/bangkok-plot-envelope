// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Design } from '../../core/types';
import { sampleEvaluation } from '../fixtures/sampleEvaluation';
import { ANNOUNCE_DELAY_MS, ResultsAnnouncer, resultsAnnouncement } from './ResultsAnnouncer';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const design = sampleEvaluation.designs[0] as Design;

function withFailures(count: number): Design {
  const checks = design.checks.map((check, index) => ({ ...check, status: index < count ? ('fail' as const) : ('pass' as const) }));
  return { ...design, checks };
}

describe('resultsAnnouncement', () => {
  it('names the design and counts passes, adding fails only when there are some', () => {
    const total = design.checks.length;
    expect(resultsAnnouncement(withFailures(0))).toBe(`${design.name}: ${total} of ${total} checks pass`);
    expect(resultsAnnouncement(withFailures(2))).toBe(`${design.name}: ${total - 2} of ${total} checks pass, 2 fail`);
  });
});

describe('ResultsAnnouncer', () => {
  it('waits for a second of quiet before the status text changes', () => {
    const { rerender } = render(<ResultsAnnouncer design={withFailures(0)} />);
    rerender(<ResultsAnnouncer design={withFailures(1)} />);
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS - 100));
    expect(screen.getByRole('status').textContent).not.toContain('1 fail');

    // A further change restarts the wait.
    rerender(<ResultsAnnouncer design={withFailures(2)} />);
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS - 100));
    expect(screen.getByRole('status').textContent).not.toContain('fail');

    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole('status').textContent).toContain('2 fail');
  });
});

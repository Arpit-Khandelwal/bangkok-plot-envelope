// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Problem, ProblemCode } from '../../core/types';
import { Problems } from './Problems';

afterEach(cleanup);

const CODES: readonly ProblemCode[] = ['height-limit-off', 'no-design', 'invalid-coordinates'];

describe('Problems', () => {
  it('renders every problem code by its message', () => {
    const problems: Problem[] = CODES.map((code) => ({ code, message: `Message for ${code}.`, blocking: code === 'invalid-coordinates' }));
    render(<Problems problems={problems} />);
    for (const code of CODES) expect(screen.getByText(`Message for ${code}.`)).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});

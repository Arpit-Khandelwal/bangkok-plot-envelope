// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { splitThai, ThaiText } from './ThaiText';

afterEach(cleanup);

describe('splitThai', () => {
  it('leaves plain text alone', () => {
    expect(splitThai('Height limit')).toEqual([{ text: 'Height limit', isThai: false }]);
  });

  it('marks clause references with their numbers', () => {
    expect(splitThai('See ข้อ 14(1) of the plan')).toEqual([
      { text: 'See ', isThai: false },
      { text: 'ข้อ 14(1)', isThai: true },
      { text: ' of the plan', isThai: false },
    ]);
  });

  it('marks zone codes and keeps the sentence full stop outside', () => {
    expect(splitThai('It covers zone ย.7.')).toEqual([
      { text: 'It covers zone ', isThai: false },
      { text: 'ย.7', isThai: true },
      { text: '.', isThai: false },
    ]);
  });
});

describe('ThaiText', () => {
  it('wraps Thai in lang="th"', () => {
    const { container } = render(<ThaiText>{'zone ย.7 only'}</ThaiText>);
    expect(container.querySelector('[lang="th"]')?.textContent).toBe('ย.7');
    expect(container.textContent).toBe('zone ย.7 only');
  });
});

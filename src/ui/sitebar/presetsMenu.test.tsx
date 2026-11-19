// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PRESETS, ROAD_WIDTH_NOTE } from '../../state/presets';
import { PresetsMenu } from './PresetsMenu';

afterEach(cleanup);

describe('PresetsMenu', () => {
  it('shows the assumed-road-width note once, at the bottom of the list', () => {
    const { container } = render(<PresetsMenu presets={PRESETS} />);
    expect(screen.getAllByText(ROAD_WIDTH_NOTE)).toHaveLength(1);
    expect(container.querySelector('.presets__list')?.lastElementChild?.textContent).toBe(ROAD_WIDTH_NOTE);
  });
});

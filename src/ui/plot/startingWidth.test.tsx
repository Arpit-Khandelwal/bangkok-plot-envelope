// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EdgeSpec } from '../../core/types';
import type { RoadCollection } from '../../site/roadWidth';
import { PRESETS } from '../../state/presets';
import { useAppStore } from '../../state/store';
import { resetStore } from '../testing/storeReset';
import { EdgeList } from './EdgeList';
import { startingWidthNote } from './startingWidth';

const roadsRef: { current: RoadCollection | null } = { current: null };
vi.mock('../../site/useRoads', () => ({ useRoads: () => roadsRef.current }));

const preset = PRESETS.find((candidate) => candidate.id === 'sukhumvit-wide-frontage');
const files = import.meta.glob('../../../public/data/roads.geojson', { query: '?raw', import: 'default', eager: true });
const realRoads = JSON.parse(Object.values(files)[0] as string) as RoadCollection;
const NEIGHBOURS: readonly EdgeSpec[] = (preset?.plot ?? []).map((): EdgeSpec => ({ kind: 'neighbour' }));
const LENGTHS = [37, 30, 37, 30];

beforeEach(() => resetStore({ plot: preset?.plot ?? null, edges: NEIGHBOURS }));
afterEach(cleanup);

describe('starting road width', () => {
  it('uses the map-data suggestion and says where it came from', async () => {
    roadsRef.current = realRoads;
    const user = userEvent.setup();
    render(<EdgeList edgeLengthsM={LENGTHS} />);
    await user.click(screen.getAllByRole('radio', { name: 'Road' })[0] as HTMLElement);
    const spec = useAppStore.getState().edges[0];
    expect(spec?.kind === 'road' ? spec.rowWidthM : 0).toBeGreaterThanOrEqual(20);
    expect(screen.getByText(/^Starting value .* estimated from map data for Sukhumvit Road\. Enter the measured width\.$/)).toBeTruthy();
  });

  it('falls back to the placeholder constant when there is no suggestion', async () => {
    roadsRef.current = null;
    const user = userEvent.setup();
    render(<EdgeList edgeLengthsM={LENGTHS} />);
    await user.click(screen.getAllByRole('radio', { name: 'Road' })[0] as HTMLElement);
    expect(useAppStore.getState().edges[0]).toEqual({ kind: 'road', roadId: 'road-1', rowWidthM: 8 });
    expect(screen.getByText('Starting value 8 m is a placeholder. Enter the measured width.')).toBeTruthy();
  });

  it('drops the note once the user types a width and keeps that width', async () => {
    roadsRef.current = null;
    const user = userEvent.setup();
    render(<EdgeList edgeLengthsM={LENGTHS} />);
    await user.click(screen.getAllByRole('radio', { name: 'Road' })[0] as HTMLElement);
    const field = screen.getByLabelText('Road width (right of way)');
    await user.clear(field);
    await user.type(field, '12{Enter}');
    expect(screen.queryByText(/Starting value/)).toBeNull();
    expect(useAppStore.getState().edges[0]).toEqual({ kind: 'road', roadId: 'road-1', rowWidthM: 12 });
  });
});

describe('startingWidthNote', () => {
  it('names a tagged width and copes with an unnamed road', () => {
    const base = { widthM: 18, roadName: null, source: 'tag' as const, distanceM: 5 };
    expect(startingWidthNote({ widthM: 18, suggestion: base })).toBe('Starting value 18 m, taken from a width tagged in map data. Enter the measured width.');
  });
});

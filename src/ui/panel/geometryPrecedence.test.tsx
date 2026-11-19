// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EdgeSpec, Evaluation, LngLat, Problem } from '../../core/types';
import type { ZoneLookup } from '../../site/context';
import type { EvaluationView } from '../../state/useEvaluation';
import { withGeometryPrecedence } from '../../state/useEvaluation';
import { sampleEvaluation } from '../fixtures/sampleEvaluation';
import { Results } from '../results/Results';
import { ZoneChip } from '../sitebar/ZoneChip';
import { resetStore } from '../testing/storeReset';
import { Panel } from './Panel';

const BOW_TIE: readonly LngLat[] = [
  [100.602, 13.695],
  [100.6025, 13.6954],
  [100.602, 13.6954],
  [100.6025, 13.695],
];
const NEIGHBOURS: readonly EdgeSpec[] = BOW_TIE.map((): EdgeSpec => ({ kind: 'neighbour' }));
const CROSSES = 'The plot outline crosses or touches itself. Move a corner so the edges no longer cross.';
const ROAD_PROMPT = 'Mark the edge that faces the road. Setbacks and the height limit are measured from it.';

function failed(problems: readonly Problem[]): Evaluation {
  return { ok: false, site: null, problems };
}

function view(evaluation: Evaluation, zoneLookup: ZoneLookup | null): EvaluationView {
  return { evaluation, zoneLookup, station: null, dataStatus: { state: 'ready' } };
}

beforeEach(() => resetStore({ plot: BOW_TIE, edges: NEIGHBOURS }));
afterEach(cleanup);

describe('an unusable outline', () => {
  const bowTie = view(failed([{ code: 'self-intersecting', message: CROSSES, blocking: true }]), { status: 'outside' });

  it('shows only the geometry problem: no zone notice, no road prompt, no 0 m²', () => {
    render(<Panel view={bowTie} design={null} mapError={null} />);
    expect(screen.getAllByText(CROSSES)).toHaveLength(1);
    expect(screen.queryByText(/outside every zone/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'No verdict for this plot' })).toBeNull();
    expect(screen.queryByText(ROAD_PROMPT)).toBeNull();
    expect(screen.queryByText('0 m²')).toBeNull();
    expect(screen.getByText('Not available for this outline')).toBeTruthy();
  });

  it('still reports the area of a plot that is only too small', () => {
    const tiny = view(failed([{ code: 'too-small', message: 'The plot is too small.', blocking: true }]), { status: 'single', zone: { code: 'ย.7', planVersion: '2556' } });
    render(<Panel view={tiny} design={null} mapError={null} />);
    expect(screen.getByText('The plot is too small.')).toBeTruthy();
    expect(screen.queryByText(ROAD_PROMPT)).toBeNull();
    expect(screen.queryByText('Not available for this outline')).toBeNull();
  });

  it('turns the zone chip neutral, with no claim about coverage', () => {
    const resolved = withGeometryPrecedence(bowTie);
    render(<ZoneChip lookup={resolved.zoneLookup} hasPlot dataStatus={resolved.dataStatus} />);
    expect(screen.getByText('Zone not checked')).toBeTruthy();
    expect(screen.queryByText(/coverage/)).toBeNull();
    expect(screen.queryByText('No zone found')).toBeNull();
  });
});

describe('other blocking states give one explanation', () => {
  it('no road edge: the prompt once', () => {
    const noRoad = view(failed([{ code: 'no-road', message: ROAD_PROMPT, blocking: true }]), { status: 'single', zone: { code: 'ย.7', planVersion: '2556' } });
    render(<Panel view={noRoad} design={null} mapError={null} />);
    expect(screen.getAllByText(ROAD_PROMPT)).toHaveLength(1);
  });

  it('invalid road width: that message alone, with no road prompt', () => {
    resetStore({ plot: BOW_TIE, edges: [{ kind: 'road', roadId: 'road-1', rowWidthM: 0 }, ...NEIGHBOURS.slice(1)] });
    const width = 'Give the road width on edge A as a number.';
    const bad = view(failed([{ code: 'invalid-road-width', message: width, blocking: true }]), { status: 'single', zone: { code: 'ย.7', planVersion: '2556' } });
    render(<Panel view={bad} design={null} mapError={null} />);
    expect(screen.getAllByText(width)).toHaveLength(1);
    expect(screen.queryByText(ROAD_PROMPT)).toBeNull();
  });

  it('nothing buildable: that message alone', () => {
    const message = 'Nothing can be built on this plot.';
    const evaluation = { ...sampleEvaluation, problems: [{ code: 'nothing-buildable', message, blocking: true }] } satisfies Evaluation;
    render(<Results evaluation={evaluation} design={null} />);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText(/No design fits/)).toBeNull();
  });

  it('no design fits: the core explanation replaces the generic sentence', () => {
    const message = 'The allowed space exists, but no concept design passes every rule in it.';
    const evaluation = { ...sampleEvaluation, designs: [], problems: [{ code: 'no-design', message, blocking: false }] } satisfies Evaluation;
    render(<Results evaluation={evaluation} design={null} />);
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(screen.queryByText(/No design fits/)).toBeNull();
  });

  it('no design fits and no explanation from the core: the generic sentence', () => {
    render(<Results evaluation={{ ...sampleEvaluation, designs: [], problems: [] }} design={null} />);
    expect(screen.getByText(/No design fits/)).toBeTruthy();
  });

  it('a single design with the core note does not repeat itself', () => {
    const only = sampleEvaluation.designs[0];
    if (!only) throw new Error('fixture needs a design');
    const message = 'Only one concept design passes every rule here.';
    const evaluation = { ...sampleEvaluation, designs: [only], problems: [{ code: 'no-design', message, blocking: false }] } satisfies Evaluation;
    render(<Results evaluation={evaluation} design={only} />);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText(/Only one design fits/)).toBeNull();
  });
});

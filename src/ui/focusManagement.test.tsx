// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESETS } from '../state/presets';
import { useAppStore } from '../state/store';
import { sampleEvaluation } from './fixtures/sampleEvaluation';
import { Panel } from './panel/Panel';
import { RuleList } from './rules/RuleList';
import { SiteBar } from './sitebar/SiteBar';
import { WhatIfNotice } from './results/WhatIfNotice';
import { resetStore, SAMPLE_EDGES, SAMPLE_PLOT } from './testing/storeReset';

function stubPhone(isPhone: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isPhone,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const dataStatus = { state: 'ready' } as const;

beforeEach(() => stubPhone(false));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('focus after a control disappears', () => {
  it('moves focus to the example plots control after "Start over"', async () => {
    resetStore({ plot: SAMPLE_PLOT, edges: SAMPLE_EDGES });
    const user = userEvent.setup();
    render(<SiteBar zoneLookup={null} dataStatus={dataStatus} />);
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Try an example plot')));
  });

  it('moves focus to the rules heading after "Switch all rules back on"', async () => {
    resetStore({ disabledRuleIds: ['plan.far'] });
    const user = userEvent.setup();
    render(
      <>
        <WhatIfNotice />
        <RuleList regime="lowRise" rules={sampleEvaluation.regimes.lowRise.rules.rules} />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Switch all rules back on' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Low-rise rules' })));
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
  });

  it.each([false, true])('closes the menus and focuses "Your plot" after choosing an example (phone: %s)', async (isPhone) => {
    stubPhone(isPhone);
    resetStore();
    const user = userEvent.setup();
    const plotHeading = document.createElement('h2');
    plotHeading.id = 'plot-heading';
    plotHeading.tabIndex = -1;
    plotHeading.textContent = 'Your plot';
    document.body.append(plotHeading);
    const { container } = render(<SiteBar zoneLookup={null} dataStatus={dataStatus} />);

    const more = container.querySelector<HTMLDetailsElement>('details.site-bar__more');
    if (more) more.open = true;
    const menu = container.querySelector<HTMLDetailsElement>('details.presets') as HTMLDetailsElement;
    menu.open = true;
    const preset = PRESETS[0];
    await user.click(screen.getByRole('button', { name: new RegExp(preset?.label ?? 'x') }));

    expect(menu.open).toBe(false);
    if (more) expect(more.open).toBe(false);
    expect(useAppStore.getState().plot).not.toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(plotHeading));
    plotHeading.remove();
  });
});

describe('landmarks', () => {
  it('makes the panel the labelled main region', () => {
    resetStore({ plot: SAMPLE_PLOT, edges: SAMPLE_EDGES });
    render(
      <Panel
        view={{ evaluation: null, zoneLookup: null, station: null, dataStatus }}
        design={null}
        mapError={null}
      />,
    );
    expect(screen.getByRole('main', { name: 'Plot and results' })).toBeTruthy();
  });

  it('groups the site bar actions rather than calling them navigation', () => {
    resetStore();
    render(<SiteBar zoneLookup={null} dataStatus={dataStatus} />);
    expect(screen.getByRole('group', { name: 'Plot actions' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Check, Design } from '../../core/types';
import { useAppStore } from '../../state/store';
import { sampleEvaluation } from '../fixtures/sampleEvaluation';
import { RuleList } from '../rules/RuleList';
import { resetStore } from '../testing/storeReset';
import { evaluate } from '../../core/evaluate';
import { NEIGHBOUR, rect, road, scenario } from '../../core/pipeline/test-scenarios';
import { AreaSchedule, scheduleTotal } from './AreaSchedule';
import { Checklist, checklistSummary } from './Checklist';
import { DesignSwitcher } from './DesignSwitcher';
import { WhatIfNotice } from './WhatIfNotice';

const [lowRise, tower] = sampleEvaluation.designs;
if (!lowRise || !tower) throw new Error('The sample evaluation needs two designs');

beforeEach(() => resetStore());
afterEach(cleanup);

describe('Checklist', () => {
  it('lists failed checks first', () => {
    const { container } = render(<Checklist checks={tower.checks} />);
    const items = [...container.querySelectorAll('.checklist > li')];
    expect(within(items[0] as HTMLElement).getByText('Fail')).toBeTruthy();
    expect(within(items[0] as HTMLElement).getByText('Height limit from the road')).toBeTruthy();
    expect(within(items[1] as HTMLElement).getByText('Check on site')).toBeTruthy();
  });

  it('shows required and actual values with their citations', () => {
    render(<Checklist checks={tower.checks} />);
    expect(screen.getByText('At most 36 m at the front face')).toBeTruthy();
    const links = screen.getAllByRole('link');
    expect(links[0]?.getAttribute('target')).toBe('_blank');
    expect(links[0]?.getAttribute('rel')).toBe('noreferrer');
  });
});

describe('checklistSummary', () => {
  it('counts passes and lists warnings and failures only when there are some', () => {
    const [a] = tower.checks;
    if (!a) throw new Error('need a check');
    const make = (statuses: Check['status'][]): Check[] => statuses.map((status) => ({ ...a, status }));
    expect(checklistSummary(make(['pass', 'pass', 'info']))).toBe('2 of 3 checks pass');
    expect(checklistSummary(make(['pass', 'warn', 'fail', 'fail']))).toBe('1 of 4 checks pass, 1 to check on site, 2 fail');
  });

  it('renders the summary above rows that put the status and title on one line', () => {
    const { container } = render(<Checklist checks={tower.checks} />);
    expect(container.querySelector('.checklist__summary')?.textContent).toBe(checklistSummary(tower.checks));
    const head = container.querySelector('.checklist > li .check__head');
    expect(head?.querySelector('.status-mark')).toBeTruthy();
    expect(head?.querySelector('h3')).toBeTruthy();
  });
});

describe('AreaSchedule', () => {
  it('shows rows to one decimal that add up to the displayed total within 0.05', () => {
    render(<AreaSchedule design={tower} />);
    const table = screen.getByRole('table');
    const bodyRows = within(table).getAllByRole('row').slice(1, -1);
    const parse = (text: string): number => Number(text.replace(/[^\d.]/g, ''));
    const areaTexts = bodyRows.map((row) => {
      const cells = within(row).getAllByRole('cell');
      return cells[cells.length - 1]?.textContent ?? '';
    });
    for (const text of areaTexts) expect(text).toMatch(/^[\d,]+\.\d m²$/);
    const rowSum = areaTexts.reduce((sum, text) => sum + parse(text), 0);
    const totalText = screen.getByTestId('schedule-total').textContent ?? '';
    expect(bodyRows).toHaveLength(tower.floors.length);
    expect(totalText).toMatch(/^[\d,]+\.\d m²$/);
    expect(Math.abs(rowSum - parse(totalText))).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(Math.abs(parse(totalText) - tower.totals.grossFloorAreaM2)).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(screen.getByTestId('schedule-note').textContent).toBe('Total = sum of the rows above.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the true total and a rounding note when the rounded rows drift', () => {
    expect(scheduleTotal([0.04, 0.04, 0.04]).isRowSum).toBe(false);
    expect(scheduleTotal([204.96, 339.04]).isRowSum).toBe(true);
    const drifting: Design = {
      ...tower,
      floors: tower.floors.slice(0, 3).map((floor) => ({ ...floor, areaM2: 100.04 })),
      totals: { ...tower.totals, grossFloorAreaM2: 300.12 },
    };
    render(<AreaSchedule design={drifting} />);
    expect(screen.getByTestId('schedule-total').textContent).toBe('300.1 m²');
    expect(screen.getByTestId('schedule-note').textContent).toBe('Rows are rounded to 0.1 m².');
  });

  it('shows a shared parking level as two rows with the same level', () => {
    const e = evaluate(scenario(rect(100, 100), [road(30), NEIGHBOUR, NEIGHBOUR, NEIGHBOUR]));
    const low = e.ok ? e.designs.find((d) => d.id === 'low-rise-block') : undefined;
    if (low === undefined) throw new Error('no low-rise design');
    render(<AreaSchedule design={low} />);
    const headers = within(screen.getByRole('table')).getAllByRole('rowheader').map((h) => h.getAttribute('aria-label'));
    // This plot's low-rise shares its ground floor: housing at the road side, parking behind.
    const shared = headers.filter((h) => h?.startsWith('Level 1,'));
    expect(shared).toEqual(['Level 1, residential', 'Level 1, parking']);
  });

  it('lists the top floor first', () => {
    render(<AreaSchedule design={lowRise} />);
    const firstRow = within(screen.getByRole('table')).getAllByRole('row')[1] as HTMLElement;
    expect(within(firstRow).getByRole('rowheader').textContent).toBe(String(lowRise.floors.length));
  });
});

describe('RuleList', () => {
  it('switches a rule off through the store', async () => {
    const user = userEvent.setup();
    const rules = sampleEvaluation.regimes.lowRise.rules.rules;
    render(<RuleList regime="lowRise" rules={rules} />);
    const switches = screen.getAllByRole('switch', { name: /^Apply this rule / });
    expect(screen.getByRole('switch', { name: `Apply this rule ${rules[0]?.title}` })).toBeTruthy();
    expect(switches.every((element) => (element as HTMLInputElement).checked)).toBe(true);
    await user.click(switches[0] as HTMLElement);
    expect(useAppStore.getState().disabledRuleIds).toEqual([rules[0]?.id]);
  });

  it('groups rules under plain headings and marks the binding one', () => {
    render(<RuleList regime="lowRise" rules={sampleEvaluation.regimes.lowRise.rules.rules} />);
    expect(screen.getByRole('heading', { name: 'Density' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Open space' })).toBeTruthy();
    expect(screen.getAllByText('Binding')).toHaveLength(1);
  });
});

describe('WhatIfNotice', () => {
  it('appears while a rule is switched off and restores all rules', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WhatIfNotice />);
    expect(screen.queryByText(/what-if view/)).toBeNull();

    resetStore({ disabledRuleIds: ['plan.far', 'plan.osr'] });
    rerender(<WhatIfNotice />);
    expect(screen.getByText('2 rules are switched off.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Switch all rules back on' }));
    expect(useAppStore.getState().disabledRuleIds).toEqual([]);
    expect(screen.queryByText(/what-if view/)).toBeNull();
  });
});

describe('DesignSwitcher', () => {
  it('shows each design with its result and selects on click', async () => {
    const user = userEvent.setup();
    render(<DesignSwitcher designs={sampleEvaluation.designs} selectedId={lowRise.id} />);
    expect(screen.getByText('1 check failed')).toBeTruthy();
    // Headers carry only the name; the selected design's summary is shown once below.
    expect(screen.getAllByText(lowRise.summary)).toHaveLength(1);
    expect(screen.queryByText(tower.summary)).toBeNull();
    expect(screen.getByRole('button', { name: lowRise.name }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: /Tower on podium/ }));
    expect(useAppStore.getState().selectedDesignId).toBe(tower.id);
  });
});

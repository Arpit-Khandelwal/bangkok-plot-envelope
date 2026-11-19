// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../state/store';
import { sampleEvaluation } from '../fixtures/sampleEvaluation';
import { formatM2 } from '../format';
import { RuleList } from '../rules/RuleList';
import { resetStore } from '../testing/storeReset';
import { AreaSchedule } from './AreaSchedule';
import { Checklist } from './Checklist';
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

describe('AreaSchedule', () => {
  it('shows a total equal to the sum of the rows and the design total', () => {
    render(<AreaSchedule design={tower} />);
    const table = screen.getByRole('table');
    const bodyRows = within(table).getAllByRole('row').slice(1, -1);
    const rowSum = bodyRows.reduce((sum, row) => {
      const cells = within(row).getAllByRole('cell');
      const areaText = cells[cells.length - 1]?.textContent ?? '';
      return sum + Number(areaText.replace(/[^\d.]/g, ''));
    }, 0);
    expect(bodyRows).toHaveLength(tower.floors.length);
    expect(rowSum).toBe(tower.totals.grossFloorAreaM2);
    expect(screen.getByTestId('schedule-total').textContent).toBe(formatM2(tower.totals.grossFloorAreaM2));
    expect(screen.queryByRole('alert')).toBeNull();
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
    const switches = screen.getAllByRole('switch', { name: 'Apply this rule' });
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
    await user.click(screen.getByRole('button', { name: /Tower on podium/ }));
    expect(useAppStore.getState().selectedDesignId).toBe(tower.id);
  });
});

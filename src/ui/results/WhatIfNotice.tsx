import { useAppStore } from '../../state/store';
import { focusSoon, RULES_HEADING_SELECTOR } from '../focus';
import { plural } from '../format';

/** Persistent warning while any rule is switched off. */
export function WhatIfNotice() {
  const count = useAppStore((state) => state.disabledRuleIds.length);
  const enableAllRules = useAppStore((state) => state.enableAllRules);
  if (count === 0) return null;

  return (
    <aside className="notice notice--whatif" role="status">
      <p>
        <strong>
          {plural(count, 'rule')} {count === 1 ? 'is' : 'are'} switched off.
        </strong>{' '}
        This is a what-if view, not a compliance result.
      </p>
      <button type="button" className="button" onClick={() => {
          enableAllRules();
          focusSoon(RULES_HEADING_SELECTOR);
        }}>
        Switch all rules back on
      </button>
    </aside>
  );
}

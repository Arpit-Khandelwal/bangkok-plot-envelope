import { DEFAULT_INTERPRETATION } from '../../state/defaults';
import { useAppStore } from '../../state/store';
import type { Interpretation } from '../../core/types';
import { focusSoon, RULES_HEADING_SELECTOR } from '../focus';
import { plural } from '../format';
import { isWhatIfState } from './whatIf';

export interface WhatIfNoticeProps {
  /** Plain sentences, one per setting read less cautiously than the default (`evaluation.nonDefaultReadings`). */
  readonly readings?: readonly string[];
}

const NO_READINGS: readonly string[] = [];

/** Persistent warning while any rule is switched off or a setting uses a less cautious reading. */
export function WhatIfNotice({ readings = NO_READINGS }: WhatIfNoticeProps) {
  const count = useAppStore((state) => state.disabledRuleIds.length);
  const enableAllRules = useAppStore((state) => state.enableAllRules);
  const setInterpretation = useAppStore((state) => state.setInterpretation);
  if (!isWhatIfState(count, readings)) return null;

  const resetReadings = (): void => {
    for (const key of Object.keys(DEFAULT_INTERPRETATION) as Array<keyof Interpretation>) {
      setInterpretation(key, DEFAULT_INTERPRETATION[key]);
    }
  };

  return (
    <aside className="notice notice--whatif" role="status">
      {count > 0 ? (
        <>
          <p>
            <strong>
              {plural(count, 'rule')} {count === 1 ? 'is' : 'are'} switched off.
            </strong>{' '}
            This is a what-if view, not a compliance result.
          </p>
          <button
            type="button"
            className="button"
            onClick={() => {
              enableAllRules();
              focusSoon(RULES_HEADING_SELECTOR);
            }}
          >
            Switch all rules back on
          </button>
        </>
      ) : null}
      {readings.length > 0 ? (
        <>
          <p>
            <strong>This result uses a less cautious reading of the rules.</strong>
          </p>
          <ul className="notice__list">
            {readings.map((reading) => (
              <li key={reading}>{reading}</li>
            ))}
          </ul>
          <button type="button" className="button" onClick={resetReadings}>
            Use the default readings
          </button>
        </>
      ) : null}
    </aside>
  );
}

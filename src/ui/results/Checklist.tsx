import type { Check, CheckStatus } from '../../core/types';
import { Citations } from '../common/Citations';
import { StatusMark } from '../common/StatusMark';

const STATUS_ORDER: Readonly<Record<CheckStatus, number>> = { fail: 0, warn: 1, pass: 2, info: 3 };

/** Failed checks first, then ones to verify on site; the original order otherwise. */
export function orderChecks(checks: readonly Check[]): Check[] {
  return checks
    .map((check, index) => ({ check, index }))
    .sort((a, b) => STATUS_ORDER[a.check.status] - STATUS_ORDER[b.check.status] || a.index - b.index)
    .map((entry) => entry.check);
}

export interface ChecklistProps {
  readonly checks: readonly Check[];
}

export function Checklist({ checks }: ChecklistProps) {
  return (
    <section className="panel-section" aria-labelledby="checks-heading">
      <h2 id="checks-heading" className="panel-section__title">
        Checks
      </h2>
      <ol className="checklist">
        {orderChecks(checks).map((check, index) => (
          <li key={`${check.ruleId}-${index}`} className={`check check--${check.status}`}>
            <StatusMark status={check.status} />
            <div className="check__body">
              <h3 className="check__title">{check.title}</h3>
              <dl className="check__values">
                <div>
                  <dt>Required</dt>
                  <dd>{check.required}</dd>
                </div>
                <div>
                  <dt>This design</dt>
                  <dd>{check.actual}</dd>
                </div>
              </dl>
              <Citations citations={check.citations} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

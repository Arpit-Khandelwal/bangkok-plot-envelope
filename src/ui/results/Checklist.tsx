import type { Check, CheckStatus } from '../../core/types';
import { Citations } from '../common/Citations';
import { ThaiText } from '../common/ThaiText';
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

/** "5 of 8 checks pass", then how many to check on site and how many fail, when any. */
export function checklistSummary(checks: readonly Check[]): string {
  const count = (status: CheckStatus): number => checks.filter((check) => check.status === status).length;
  const parts = [`${count('pass')} of ${checks.length} checks pass`];
  if (count('warn') > 0) parts.push(`${count('warn')} to check on site`);
  if (count('fail') > 0) parts.push(`${count('fail')} fail`);
  return parts.join(', ');
}

export function Checklist({ checks }: ChecklistProps) {
  return (
    <section className="panel-section" aria-labelledby="checks-heading">
      <h2 id="checks-heading" className="panel-section__title">
        Checks
      </h2>
      <p className="checklist__summary">{checklistSummary(checks)}</p>
      <ol className="checklist">
        {orderChecks(checks).map((check, index) => (
          <li key={`${check.ruleId}-${index}`} className={`check check--${check.status}`}>
            <div className="check__head">
              <StatusMark status={check.status} />
              <h3 className="check__title"><ThaiText>{check.title}</ThaiText></h3>
            </div>
            <dl className="check__values">
              <div>
                <dt>Required</dt>
                <dd>
                  <ThaiText>{check.required}</ThaiText>
                </dd>
              </div>
              <div>
                <dt>This design</dt>
                <dd>
                  <ThaiText>{check.actual}</ThaiText>
                </dd>
              </div>
            </dl>
            <Citations citations={check.citations} />
          </li>
        ))}
      </ol>
    </section>
  );
}

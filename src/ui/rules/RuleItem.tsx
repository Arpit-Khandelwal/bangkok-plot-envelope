import { useId } from 'react';
import type { AppliedRule } from '../../core/types';
import { useAppStore } from '../../state/store';
import { Citations } from '../common/Citations';
import { asSentence } from '../format';

export interface RuleItemProps {
  readonly rule: AppliedRule;
}

export function RuleItem({ rule }: RuleItemProps) {
  const toggleRule = useAppStore((state) => state.toggleRule);
  const switchId = useId();
  const titleId = useId();

  return (
    <li className={`rule${rule.disabled ? ' rule--off' : ''}${rule.binding ? ' rule--binding' : ''}`}>
      <div className="rule__head">
        <h4 id={titleId} className="rule__title">
          {rule.title}
          {rule.binding ? <span className="rule__binding">Binding</span> : null}
        </h4>
        <span className="switch">
          <input
            id={switchId}
            type="checkbox"
            role="switch"
            className="switch__input"
            checked={!rule.disabled}
            onChange={() => toggleRule(rule.id)}
            aria-describedby={titleId}
          />
          <label htmlFor={switchId} className="switch__label">
            Apply this rule
          </label>
        </span>
      </div>
      {rule.titleTh ? (
        <p lang="th" className="rule__thai thai">
          {rule.titleTh}
        </p>
      ) : null}
      <p className="rule__requirement">{asSentence(rule.requirement)}</p>
      {rule.basis ? <p className="rule__basis">{asSentence(rule.basis)}</p> : null}
      <Citations citations={rule.citations} />
    </li>
  );
}

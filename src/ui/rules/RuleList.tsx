import type { AppliedRule, RegimeId, RuleCategory } from '../../core/types';
import { RuleItem } from './RuleItem';

const CATEGORY_ORDER: readonly { readonly category: RuleCategory; readonly heading: string }[] = [
  { category: 'use', heading: 'Use' },
  { category: 'density', heading: 'Density' },
  { category: 'height', heading: 'Height' },
  { category: 'setback', heading: 'Setbacks' },
  { category: 'openSpace', heading: 'Open space' },
  { category: 'access', heading: 'Access' },
  { category: 'parking', heading: 'Parking' },
  { category: 'process', heading: 'Process' },
];

const REGIME_NAMES: Readonly<Record<RegimeId, string>> = {
  lowRise: 'Low-rise rules',
  highRise: 'High-rise rules',
};

export interface RuleListProps {
  readonly regime: RegimeId;
  readonly rules: readonly AppliedRule[];
}

/** The rules behind the selected design, grouped by what they control. */
export function RuleList({ regime, rules }: RuleListProps) {
  const groups = CATEGORY_ORDER.map((group) => ({ ...group, rules: rules.filter((rule) => rule.category === group.category) })).filter(
    (group) => group.rules.length > 0,
  );

  return (
    <section className="panel-section" aria-labelledby="rules-heading">
      <h2 id="rules-heading" className="panel-section__title" tabIndex={-1}>
        {REGIME_NAMES[regime]}
      </h2>
      <p className="panel-section__lede">
        There are two rule sets, Low-rise rules and High-rise rules. A building whose roof deck is 23 m or higher, or whose floor area is 10,000 m² or more, follows
        the stricter set for the whole building.
      </p>
      {groups.map((group) => (
        <section key={group.category} className="rule-group" aria-labelledby={`rule-group-${group.category}`}>
          <h3 id={`rule-group-${group.category}`} className="rule-group__title">
            {group.heading}
          </h3>
          <ul className="rule-group__list">
            {group.rules.map((rule, index) => (
              <RuleItem key={`${rule.id}-${index}`} rule={rule} />
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

import { useId } from 'react';
import type { Interpretation } from '../../core/types';
import { useAppStore } from '../../state/store';

/**
 * `frontOpenSpaceOnPublicRoad` is added to `Interpretation` by the core. Until it lands this
 * widening type lets the switch compile; once it lands the intersection changes nothing.
 */
type InterpretationWithFront = Interpretation & { readonly frontOpenSpaceOnPublicRoad?: boolean };

const FRONT_KEY = 'frontOpenSpaceOnPublicRoad';

type SwitchKey = 'parkingCountsInFar' | 'officeParkingCountsInOperatingArea' | typeof FRONT_KEY;

interface SwitchSpec {
  readonly key: SwitchKey;
  readonly label: string;
  readonly explanation: string;
  /** The position that gives the more cautious (smaller or stricter) result. */
  readonly cautiousIsOn: boolean;
}

export const INTERPRETATION_SWITCHES: readonly SwitchSpec[] = [
  {
    key: 'parkingCountsInFar',
    label: 'Count parking floors toward the floor area ratio (FAR)',
    explanation: 'The 2013 plan excludes nothing from floor area and exempts only extra public parking.',
    cautiousIsOn: true,
  },
  {
    key: 'officeParkingCountsInOperatingArea',
    label: "Count an office's own parking in its operating area",
    explanation: "The plan measures offices by operating area. Whether an office's own car park counts is not settled.",
    cautiousIsOn: true,
  },
  {
    key: FRONT_KEY,
    label: 'Require a 12 m front open space even on a public road',
    explanation:
      'The Bangkok ordinance asks for a front open space of 6 m, or 12 m above three storeys. We read that as applying to buildings set back from the public road; a building on the road must instead face it with more than one eighth of its perimeter. Switch this on for the stricter reading.',
    cautiousIsOn: true,
  },
];

/** Reads one setting; a field the core has not added yet reads as false, its default. */
export function readInterpretation(interpretation: Interpretation, key: SwitchKey): boolean {
  const widened: InterpretationWithFront = interpretation;
  return widened[key] ?? false;
}

/** Returns a copy of the interpretation with one setting changed. */
export function withInterpretation(interpretation: Interpretation, key: SwitchKey, value: boolean): Interpretation {
  const next: InterpretationWithFront = { ...interpretation, [key]: value };
  return next;
}

function InterpretationSwitch({ spec }: { readonly spec: SwitchSpec }) {
  const checked = useAppStore((state) => readInterpretation(state.interpretation, spec.key));
  const switchId = useId();
  const explainId = useId();
  return (
    <>
      <div className="switch switch--block">
        <input
          id={switchId}
          type="checkbox"
          role="switch"
          className="switch__input"
          checked={checked}
          onChange={(event) =>
            useAppStore.setState((state) => ({ interpretation: withInterpretation(state.interpretation, spec.key, event.target.checked) }))
          }
          aria-describedby={explainId}
        />
        <label htmlFor={switchId} className="switch__label">
          {spec.label}
        </label>
      </div>
      <p id={explainId} className="number-field__hint">
        {spec.explanation} <span className="reading-mark">Stricter when {spec.cautiousIsOn ? 'on' : 'off'}.</span>
      </p>
    </>
  );
}

/** The interpretation switches, grouped under one heading. */
export function InterpretationSwitches() {
  const headingId = useId();
  return (
    <section className="reading-group" aria-labelledby={headingId}>
      <h3 id={headingId} className="reading-group__title">
        How unclear rules are read
      </h3>
      {INTERPRETATION_SWITCHES.map((spec) => (
        <InterpretationSwitch key={spec.key} spec={spec} />
      ))}
    </section>
  );
}

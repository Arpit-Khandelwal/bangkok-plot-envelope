import { useEffect, useId, useState } from 'react';
import { formatNumber } from '../format';
import { parseBoundedNumber } from './numberInput';
import type { NumberRule } from './numberInput';

export interface NumberFieldProps extends NumberRule {
  readonly label: string;
  readonly hint?: string;
  /** The stored value, in display units. */
  readonly value: number;
  readonly maxDecimals?: number;
  /** Called only with a valid number. Invalid text stays in the field with a message. */
  readonly onCommit: (value: number) => void;
}

/**
 * A text field for numbers. It keeps the user's draft locally and pushes to the store only
 * when the draft parses and is in range, so NaN or out-of-range values never reach the evaluation.
 * Commits on blur or Enter.
 */
export function NumberField({ label, hint, value, unit, min, max, maxDecimals = 2, onCommit }: NumberFieldProps) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(() => formatNumber(value, maxDecimals).replace(/,/g, ''));
  const [error, setError] = useState<string | null>(null);

  // Follow outside changes (another edge on the same road, a reset) unless the draft already says it.
  useEffect(() => {
    setDraft((current) => {
      const parsed = parseBoundedNumber(current, { min, max, unit });
      return parsed.ok && parsed.value === value ? current : formatNumber(value, maxDecimals).replace(/,/g, '');
    });
    setError(null);
  }, [value, min, max, unit, maxDecimals]);

  // Validate on every keystroke; commit on blur or Enter so half-typed numbers never reach the store.
  const handleChange = (text: string): void => {
    setDraft(text);
    const parsed = parseBoundedNumber(text, { min, max, unit });
    setError(parsed.ok ? null : parsed.message);
  };

  const commit = (): void => {
    const parsed = parseBoundedNumber(draft, { min, max, unit });
    if (parsed.ok && parsed.value !== value) onCommit(parsed.value);
  };

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="number-field">
      <label htmlFor={inputId} className="number-field__label">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="number-field__hint">
          {hint}
        </p>
      ) : null}
      <span className="number-field__control">
        <input
          id={inputId}
          className="number-field__input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
        {unit ? <span className="number-field__unit">{unit}</span> : null}
      </span>
      {error ? (
        <p id={errorId} className="number-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

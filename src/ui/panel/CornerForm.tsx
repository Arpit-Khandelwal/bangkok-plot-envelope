import { useId, useRef, useState, type FormEvent } from 'react';
import { neighbourEdges } from '../../state/edges';
import { useAppStore } from '../../state/store';
import { focusSoon, PLOT_HEADING_SELECTOR } from '../focus';
import { CORNER_FORMAT_HINT, formatCorners, parseCorners } from './parseCorners';

/** Types the plot in as coordinates: the way to draw without a pointer. */
export function CornerForm() {
  const plot = useAppStore((state) => state.plot);
  const loadScenario = useAppStore((state) => state.loadScenario);
  const [draft, setDraft] = useState(() => (plot ? formatCorners(plot) : ''));
  const [error, setError] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();

  const refreshFromPlot = (): void => {
    if (!detailsRef.current?.open) return;
    const current = useAppStore.getState().plot;
    setDraft(current ? formatCorners(current) : '');
    setError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsed = parseCorners(draft);
    if (!parsed.ok) {
      setError(parsed.message);
      fieldRef.current?.focus();
      return;
    }
    setError(null);
    const state = useAppStore.getState();
    loadScenario({
      plot: parsed.plot,
      edges: neighbourEdges(parsed.plot.length),
      buildingType: state.buildingType,
      assumptions: state.assumptions,
      interpretation: state.interpretation,
      disabledRuleIds: state.disabledRuleIds,
      selectedDesignId: state.selectedDesignId,
    });
    if (detailsRef.current) detailsRef.current.open = false;
    focusSoon(PLOT_HEADING_SELECTOR);
  };

  return (
    <details ref={detailsRef} className="corner-form" onToggle={refreshFromPlot}>
      <summary className="corner-form__summary">{plot ? 'Edit corner coordinates' : 'Enter corner coordinates'}</summary>
      <form className="corner-form__body" onSubmit={submit} noValidate>
        <label htmlFor={fieldId} className="number-field__label">
          Corners
        </label>
        <p id={hintId} className="number-field__hint">
          {CORNER_FORMAT_HINT}
        </p>
        <textarea
          id={fieldId}
          ref={fieldRef}
          className="corner-form__field"
          rows={5}
          spellCheck={false}
          autoComplete="off"
          value={draft}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          onChange={(event) => setDraft(event.target.value)}
        />
        {error ? (
          <p id={errorId} className="number-field__error">
            {error}
          </p>
        ) : null}
        <button type="submit" className="button">
          Use these corners
        </button>
      </form>
    </details>
  );
}

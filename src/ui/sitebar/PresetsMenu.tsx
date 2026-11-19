import { useRef } from 'react';
import type { NamedPlotPreset } from '../../state/presets';
import { useAppStore } from '../../state/store';

export interface PresetsMenuProps {
  readonly presets: readonly NamedPlotPreset[];
}

/** "Try an example plot". Hidden while there are no presets. */
export function PresetsMenu({ presets }: PresetsMenuProps) {
  const loadPreset = useAppStore((state) => state.loadPreset);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  if (presets.length === 0) return null;

  const choose = (preset: NamedPlotPreset): void => {
    loadPreset(preset);
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details ref={detailsRef} className="presets">
      <summary className="button button--quiet presets__summary">Try an example plot</summary>
      <ul className="presets__list">
        {presets.map((preset) => (
          <li key={preset.id}>
            <button type="button" className="presets__option" onClick={() => choose(preset)}>
              <span className="presets__label">{preset.label}</span>
              <span className="presets__description">{preset.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

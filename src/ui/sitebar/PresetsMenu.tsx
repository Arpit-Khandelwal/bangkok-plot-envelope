import { useRef } from 'react';
import { ROAD_WIDTH_NOTE, type NamedPlotPreset } from '../../state/presets';
import { useAppStore } from '../../state/store';
import { focusSoon, PLOT_HEADING_SELECTOR } from '../focus';

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
    if (detailsRef.current) {
      detailsRef.current.open = false;
      // On a phone the menu sits inside the "More" disclosure, which would stay open over the map.
      const more = detailsRef.current.closest<HTMLDetailsElement>('details.site-bar__more');
      if (more) more.open = false;
    }
    focusSoon(PLOT_HEADING_SELECTOR);
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
        <li className="presets__note">{ROAD_WIDTH_NOTE}</li>
      </ul>
    </details>
  );
}

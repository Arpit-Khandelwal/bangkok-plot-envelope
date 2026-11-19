import { COVERED_ZONE } from '../zone/zoneCoverage';
import { useIsPhone } from '../layout/useMediaQuery';

interface LegendEntry {
  readonly key: string;
  readonly label: string;
}

const ENTRIES: readonly LegendEntry[] = [
  { key: 'glass', label: 'Allowed space under this design’s rules' },
  { key: 'ghost', label: 'Allowed space under the other rule set' },
  { key: 'solid', label: 'The design' },
  { key: 'context', label: 'Surrounding buildings (heights from satellite data; lighter blocks are estimates)' },
  { key: 'zone', label: 'Edge of zone' },
];

function LegendList() {
  return (
    <ul className="legend__list">
      {ENTRIES.map((entry) => (
        <li key={entry.key} className="legend__item">
          <span className={`legend__swatch legend__swatch--${entry.key}`} aria-hidden="true" />
          {entry.key === 'zone' ? (
            <span>
              Edge of zone <span lang="th">{COVERED_ZONE.code}</span>
            </span>
          ) : (
            <span>{entry.label}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Key to the 3D model. Each swatch is drawn in CSS to match the map. A block over the map on a
 * desktop; a closed disclosure below the map on a phone.
 */
export function Legend() {
  const isPhone = useIsPhone();
  if (isPhone) {
    return (
      <details className="legend legend--collapsible">
        <summary className="legend__summary">What the colours mean</summary>
        <LegendList />
      </details>
    );
  }
  return (
    <section className="legend" aria-label="Map key">
      <LegendList />
    </section>
  );
}

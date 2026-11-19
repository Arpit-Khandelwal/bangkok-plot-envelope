interface LegendEntry {
  readonly key: string;
  readonly label: string;
}

const ENTRIES: readonly LegendEntry[] = [
  { key: 'glass', label: 'Allowed space under this design’s rules' },
  { key: 'ghost', label: 'Allowed space under the other rule set' },
  { key: 'solid', label: 'The design' },
  { key: 'context', label: 'Surrounding buildings (heights from satellite data; lighter blocks are estimates)' },
  { key: 'zone', label: 'Edge of zone ย.7' },
];

/** Key to the 3D model. Each swatch is drawn in CSS to match the map. */
export function Legend() {
  return (
    <section className="legend" aria-label="Map key">
      <ul className="legend__list">
        {ENTRIES.map((entry) => (
          <li key={entry.key} className="legend__item">
            <span className={`legend__swatch legend__swatch--${entry.key}`} aria-hidden="true" />
            <span>{entry.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

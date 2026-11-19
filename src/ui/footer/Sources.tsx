/** Data sources, attribution and the legal caveat. */
export function Sources() {
  return (
    <footer className="sources">
      <h2 className="sources__title">Sources</h2>
      <ul className="sources__list">
        <li>
          Map data ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap contributors
          </a>
        </li>
        <li>
          Building footprints from the{' '}
          <a href="https://overturemaps.org" target="_blank" rel="noreferrer">
            Overture Maps Foundation
          </a>
        </li>
        <li>
          Base map by{' '}
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
            OpenFreeMap
          </a>
        </li>
        <li>Zones from the Bangkok Comprehensive Plan B.E. 2556</li>
      </ul>
      <p>Surrounding building heights are estimated where no survey data exists.</p>
      <p className="sources__caveat">Not legal advice. Confirm with the district office before relying on these figures.</p>
    </footer>
  );
}

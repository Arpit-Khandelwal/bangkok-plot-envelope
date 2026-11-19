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
        <li>
          Building heights from{' '}
          <a href="https://sites.research.google/gr/open-buildings/" target="_blank" rel="noreferrer">
            Google Open Buildings 2.5D Temporal
          </a>{' '}
          (CC BY 4.0)
        </li>
        <li>Zones from the Bangkok Comprehensive Plan B.E. 2556</li>
      </ul>
      <p>
        Surrounding buildings: real footprints (Overture Maps, OpenStreetMap). Heights measured from satellite data (Google Open
        Buildings 2.5D, 2023), typically within about one storey for ordinary buildings and less reliable for towers; lighter
        blocks are estimates.
      </p>
      <p className="sources__caveat">Not legal advice. Confirm with the district office before relying on these figures.</p>
    </footer>
  );
}

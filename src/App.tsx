import { useState } from 'react';
import { MapView } from './map/MapView';

export function App() {
  const [dataError, setDataError] = useState<string | null>(null);

  return (
    <main>
      <MapView model={null} onDataError={setDataError} />
      {dataError ? (
        <p className="spike-readout" role="alert">
          {dataError}
        </p>
      ) : null}
    </main>
  );
}

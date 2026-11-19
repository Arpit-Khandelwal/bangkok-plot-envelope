import { useState } from 'react';
import { MapView } from './map/MapView';

export function App() {
  const [ring, setRing] = useState<[number, number][] | null>(null);

  return (
    <main>
      <MapView onPlotChange={setRing} />
      <aside className="spike-readout" data-testid="plot-readout">
        {ring ? `Plot with ${ring.length - 1} corners` : 'Click on the map to draw a plot. Click the first corner again to close it.'}
      </aside>
    </main>
  );
}

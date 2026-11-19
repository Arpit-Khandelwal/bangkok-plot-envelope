import { useEffect, useMemo, useState } from 'react';
import { MapView } from './map/MapView';
import { useAppStore } from './state/store';
import { useEvaluation } from './state/useEvaluation';
import { Legend } from './ui/legend/Legend';
import { buildModel, resolveDesign } from './ui/model/buildModel';
import { Panel } from './ui/panel/Panel';
import { SiteBar } from './ui/sitebar/SiteBar';

export function App() {
  const [mapError, setMapError] = useState<string | null>(null);
  const view = useEvaluation();
  const selectedDesignId = useAppStore((state) => state.selectedDesignId);
  const selectDesign = useAppStore((state) => state.selectDesign);
  const { evaluation } = view;

  const design = useMemo(
    () => (evaluation?.ok ? resolveDesign(evaluation, selectedDesignId) : null),
    [evaluation, selectedDesignId],
  );
  const designId = design?.id ?? null;
  // Keyed on the resolved id, so the 3D scene is rebuilt only when what it shows changes.
  const model = useMemo(() => buildModel(evaluation, designId), [evaluation, designId]);

  // A missing or stale selection falls back to the first design; record it so the store agrees.
  useEffect(() => {
    if (designId !== null && designId !== selectedDesignId) selectDesign(designId);
  }, [designId, selectedDesignId, selectDesign]);

  return (
    <div className="app">
      <div className="map-overlay">
        <SiteBar zoneLookup={view.zoneLookup} dataStatus={view.dataStatus} />
        {model ? <Legend /> : null}
      </div>
      <main className="stage" aria-label="Site map">
        <MapView model={model} onDataError={setMapError} />
      </main>
      <Panel view={view} design={design} mapError={mapError} />
    </div>
  );
}

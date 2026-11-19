import type { ZoneLookup } from '../../site/context';
import { PRESETS } from '../../state/presets';
import { useAppStore } from '../../state/store';
import type { DataStatus } from '../../state/useEvaluation';
import { BuildingTypeControl } from './BuildingTypeControl';
import { PresetsMenu } from './PresetsMenu';
import { ZoneChip } from './ZoneChip';

export interface SiteBarProps {
  readonly zoneLookup: ZoneLookup | null;
  readonly dataStatus: DataStatus;
}

/** Zone, building type and plot actions, floating over the top-left of the map. */
export function SiteBar({ zoneLookup, dataStatus }: SiteBarProps) {
  const hasPlot = useAppStore((state) => state.plot !== null);
  const clearPlot = useAppStore((state) => state.clearPlot);

  return (
    <header className="site-bar">
      <h1 className="site-bar__title">Bangkok plot envelope</h1>
      <ZoneChip lookup={zoneLookup} hasPlot={hasPlot} dataStatus={dataStatus} />
      <BuildingTypeControl />
      <nav className="site-bar__actions" aria-label="Plot">
        <PresetsMenu presets={PRESETS} />
        {hasPlot ? (
          <button type="button" className="button button--quiet" onClick={clearPlot}>
            Start over
          </button>
        ) : null}
      </nav>
    </header>
  );
}

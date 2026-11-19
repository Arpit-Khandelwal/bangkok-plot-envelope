import type { ZoneLookup } from '../../site/context';
import { PRESETS } from '../../state/presets';
import { useAppStore } from '../../state/store';
import type { DataStatus } from '../../state/useEvaluation';
import { useIsPhone } from '../layout/useMediaQuery';
import { BuildingTypeControl } from './BuildingTypeControl';
import { PresetsMenu } from './PresetsMenu';
import { ZoneChip } from './ZoneChip';

export interface SiteBarProps {
  readonly zoneLookup: ZoneLookup | null;
  readonly dataStatus: DataStatus;
}

/** Zone, building type and plot actions, floating over the top-left of the map; one compact row above the map on a phone. */
export function SiteBar({ zoneLookup, dataStatus }: SiteBarProps) {
  const hasPlot = useAppStore((state) => state.plot !== null);
  const clearPlot = useAppStore((state) => state.clearPlot);
  const isPhone = useIsPhone();

  const actions = (
    <nav className="site-bar__actions" aria-label="Plot">
      <PresetsMenu presets={PRESETS} />
      {hasPlot ? (
        <button type="button" className="button button--quiet" onClick={clearPlot}>
          Start over
        </button>
      ) : null}
    </nav>
  );

  return (
    <header className="site-bar">
      <h1 className="site-bar__title">Buildable: Bangkok edition</h1>
      <ZoneChip lookup={zoneLookup} hasPlot={hasPlot} dataStatus={dataStatus} />
      <BuildingTypeControl />
      {isPhone ? (
        <details className="site-bar__more">
          <summary className="button button--quiet site-bar__more-summary">More</summary>
          <div className="site-bar__more-body">{actions}</div>
        </details>
      ) : (
        actions
      )}
    </header>
  );
}

import type { ZoneLookup } from '../../site/context';
import { PRESETS } from '../../state/presets';
import { useAppStore } from '../../state/store';
import type { DataStatus } from '../../state/useEvaluation';
import { useIsPhone } from '../layout/useMediaQuery';
import { EXAMPLES_SUMMARY_SELECTOR, focusSoon } from '../focus';
import { BuildingTypeControl } from './BuildingTypeControl';
import { CopyLinkButton } from './CopyLinkButton';
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

  // The button unmounts with the plot, so focus goes to the example menu that stays.
  const startOver = (): void => {
    clearPlot();
    focusSoon(EXAMPLES_SUMMARY_SELECTOR);
  };

  const actions = (
    <div className="site-bar__actions" role="group" aria-label="Plot actions">
      <PresetsMenu presets={PRESETS} />
      {hasPlot ? (
        <>
          <button type="button" className="button button--quiet" onClick={startOver}>
            Start over
          </button>
          <CopyLinkButton />
        </>
      ) : null}
    </div>
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

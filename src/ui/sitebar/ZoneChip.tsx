import type { ReactNode } from 'react';
import type { ZoneLookup } from '../../site/context';
import type { DataStatus } from '../../state/useEvaluation';
import { ZoneCodes } from '../zone/ZoneCodes';
import { COVERED_PLAN_LABEL, COVERED_ZONE, COVERED_ZONE_NAME, isOutsideCoverage } from '../zone/zoneCoverage';

export interface ZoneChipProps {
  readonly lookup: ZoneLookup | null;
  readonly hasPlot: boolean;
  readonly dataStatus: DataStatus;
}

function foundCodes(lookup: ZoneLookup): ReactNode {
  switch (lookup.status) {
    case 'outside':
      return 'No zone found';
    case 'straddles':
      return (
        <>
          Crosses <ZoneCodes zones={lookup.zones} />
        </>
      );
    case 'single':
      return (
        <>
          Zone <ZoneCodes zones={[lookup.zone]} />
        </>
      );
  }
}

/** The zone in the plan's own orange, or a plain chip when the plot is somewhere else. */
export function ZoneChip({ lookup, hasPlot, dataStatus }: ZoneChipProps) {
  if (hasPlot && !lookup) {
    return (
      <p className="zone-chip zone-chip--outside">
        <span className="zone-chip__code">{dataStatus.state === 'loading' ? 'Checking the zone' : 'Zone not checked'}</span>
        <span className="zone-chip__name">{dataStatus.state === 'error' ? 'The zone map did not load' : 'One moment'}</span>
      </p>
    );
  }
  if (lookup && isOutsideCoverage(lookup)) {
    return (
      <p className="zone-chip zone-chip--outside">
        <span className="zone-chip__code">{foundCodes(lookup)}</span>
        <span className="zone-chip__name">Outside this tool’s coverage</span>
      </p>
    );
  }
  return (
    <p className="zone-chip">
      <span className="zone-chip__code thai" lang="th">
        {COVERED_ZONE.code}
      </span>
      <span className="zone-chip__text">
        <span className="zone-chip__name">{COVERED_ZONE_NAME}</span>
        <span className="zone-chip__plan">{COVERED_PLAN_LABEL}</span>
      </span>
    </p>
  );
}

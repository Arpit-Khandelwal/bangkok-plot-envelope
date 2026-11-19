import type { ZoneLookup } from '../../site/context';
import { COVERED_ZONE, listZoneCodes } from './zoneCoverage';

export interface ZoneNoticeProps {
  readonly lookup: ZoneLookup;
}

function foundSentence(lookup: ZoneLookup): string {
  switch (lookup.status) {
    case 'outside':
      return 'This plot is outside every zone on the 2013 city plan map we hold.';
    case 'straddles':
      return `This plot crosses a zone boundary: it touches ${listZoneCodes(lookup.zones)}.`;
    case 'single':
      return `This plot is in zone ${lookup.zone.code} of the B.E. ${lookup.zone.planVersion} plan.`;
  }
}

/** Explains why there is no verdict when the plot is not wholly in zone ย.7. */
export function ZoneNotice({ lookup }: ZoneNoticeProps) {
  return (
    <section className="notice notice--zone" aria-labelledby="zone-notice-heading">
      <h2 id="zone-notice-heading" className="notice__title">
        No verdict for this plot
      </h2>
      <p>{foundSentence(lookup)}</p>
      <p>
        This tool covers zone{' '}
        <span lang="th" className="thai">
          {COVERED_ZONE.code}
        </span>{' '}
        only, so it gives no verdict here. Move or redraw the plot inside the orange dashed outline on the map.
      </p>
    </section>
  );
}

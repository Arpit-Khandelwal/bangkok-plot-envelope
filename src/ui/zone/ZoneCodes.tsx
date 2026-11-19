import { Fragment } from 'react';
import type { ZoneRef } from '../../core/types';

export interface ZoneCodesProps {
  readonly zones: readonly ZoneRef[];
}

/** Zone codes as a sentence list ("ย.7, ย.8 and ย.9"), each code marked as Thai. */
export function ZoneCodes({ zones }: ZoneCodesProps) {
  const codes = [...new Set(zones.map((zone) => zone.code))];
  return (
    <>
      {codes.map((code, index) => (
        <Fragment key={code}>
          {index === 0 ? '' : index === codes.length - 1 ? ' and ' : ', '}
          <span lang="th">{code}</span>
        </Fragment>
      ))}
    </>
  );
}

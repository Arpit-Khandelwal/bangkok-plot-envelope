import type { Design, FloorUse } from '../../core/types';
import { formatM2, formatMetres, formatNumber } from '../format';

export const USE_LABELS: Readonly<Record<FloorUse, string>> = {
  residential: 'Residential',
  office: 'Office',
  parking: 'Parking',
  mixed: 'Mixed use',
};

/** Floor areas are shown to the whole square metre. */
const AREA_TOLERANCE_M2 = 0.5;

export interface AreaScheduleProps {
  readonly design: Design;
}

/** Within one level, main use above parking, as the schedule reads from the top down. */
function useRank(use: FloorUse): number {
  return use === 'parking' ? 1 : 0;
}

/**
 * Floors from the top down, with a total that is the sum of the rows shown. A shared level
 * (parking at the back, main use at the road side) is two rows with the same level number.
 */
export function AreaSchedule({ design }: AreaScheduleProps) {
  const floors = [...design.floors].sort((a, b) => b.level - a.level || useRank(a.use) - useRank(b.use));
  const total = floors.reduce((sum, floor) => sum + floor.areaM2, 0);
  const levelCount = new Set(floors.map((floor) => floor.level)).size;
  const { totals } = design;

  return (
    <section className="panel-section" aria-labelledby="schedule-heading">
      <h2 id="schedule-heading" className="panel-section__title">
        Area schedule
      </h2>
      <table className="schedule">
        <caption className="visually-hidden">Floor areas of {design.name}, top floor first</caption>
        <colgroup>
          <col className="schedule__level" />
          <col />
          <col className="schedule__height" />
          <col className="schedule__area" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Level</th>
            <th scope="col">Use</th>
            <th scope="col" className="num">
              Floor to floor
            </th>
            <th scope="col" className="num">
              Area
            </th>
          </tr>
        </thead>
        <tbody>
          {floors.map((floor) => (
            <tr key={`${floor.level}-${floor.use}`}>
              <th scope="row" className="num" aria-label={`Level ${floor.level}, ${USE_LABELS[floor.use].toLowerCase()}`}>
                {floor.level}
              </th>
              <td>
                <span className={`swatch swatch--${floor.use}`} aria-hidden="true" />
                {USE_LABELS[floor.use]}
              </td>
              <td className="num">{formatMetres(floor.topM - floor.baseM, 2)}</td>
              <td className="num">{formatM2(floor.areaM2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              Total, {formatNumber(levelCount)} floors
            </th>
            <td className="num" data-testid="schedule-total">
              {formatM2(total)}
            </td>
          </tr>
        </tfoot>
      </table>
      {Math.abs(total - totals.grossFloorAreaM2) > AREA_TOLERANCE_M2 ? (
        <p className="notice notice--fail" role="alert">
          The floors add up to {formatM2(total)}, but the design total says {formatM2(totals.grossFloorAreaM2)}. Treat these
          figures with caution and report the plot you drew.
        </p>
      ) : null}
      <dl className="facts facts--split">
        <div className="facts__row">
          <dt>Main use</dt>
          <dd className="num">{formatM2(totals.mainUseFloorAreaM2)}</dd>
        </div>
        <div className="facts__row">
          <dt>Parking</dt>
          <dd className="num">{formatM2(totals.parkingFloorAreaM2)}</dd>
        </div>
        <div className="facts__row">
          <dt>Sellable area</dt>
          <dd className="num">{formatM2(totals.sellableAreaM2)}</dd>
        </div>
      </dl>
    </section>
  );
}

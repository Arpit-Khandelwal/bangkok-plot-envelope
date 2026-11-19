import type { Design, FloorUse } from '../../core/types';
import { formatM2Tenths, formatMetres, formatNumber } from '../format';

export const USE_LABELS: Readonly<Record<FloorUse, string>> = {
  residential: 'Residential',
  office: 'Office',
  parking: 'Parking',
  mixed: 'Mixed use',
};

/** Gap between the floor list and the design total that is worth warning about. */
const AREA_TOLERANCE_M2 = 0.5;
/** Rows are shown to 0.1 m²; a displayed sum this close to the true total is shown as the total. */
const DISPLAY_SUM_TOLERANCE_M2 = 0.05;
const EPSILON = 1e-9;
const TENTHS_PER_M2 = 10;

/** The total as displayed: the sum of the displayed rows when that matches the truth, else the truth. */
export function scheduleTotal(areasM2: readonly number[]): { readonly shownM2: number; readonly isRowSum: boolean } {
  const trueTotal = areasM2.reduce((sum, area) => sum + area, 0);
  const tenths = areasM2.reduce((sum, area) => sum + Math.round(area * TENTHS_PER_M2), 0);
  const rowSum = tenths / TENTHS_PER_M2;
  const isRowSum = Math.abs(rowSum - trueTotal) <= DISPLAY_SUM_TOLERANCE_M2 + EPSILON;
  return { shownM2: isRowSum ? rowSum : trueTotal, isRowSum };
}

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
  const shown = scheduleTotal(floors.map((floor) => floor.areaM2));
  const levelCount = new Set(floors.map((floor) => floor.level)).size;
  const { totals } = design;

  return (
    <section className="panel-section" aria-labelledby="schedule-heading">
      <h2 id="schedule-heading" className="panel-section__title">
        Area schedule
      </h2>
      <div className="schedule-scroll">
      <table className="schedule">
        <caption className="visually-hidden">Floor areas of {design.name}, top floor first</caption>
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
              <td className="num">{formatM2Tenths(floor.areaM2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              Total, {formatNumber(levelCount)} floors
            </th>
            <td className="num" data-testid="schedule-total">
              {formatM2Tenths(shown.shownM2)}
            </td>
          </tr>
        </tfoot>
      </table>
      </div>
      <p className="schedule-note" data-testid="schedule-note">
        {shown.isRowSum ? 'Total = sum of the rows above.' : 'Rows are rounded to 0.1 m².'}
      </p>
      <p className="scroll-hint">Scroll sideways to see every column.</p>
      {Math.abs(total - totals.grossFloorAreaM2) > AREA_TOLERANCE_M2 ? (
        <p className="notice notice--fail" role="alert">
          The floors add up to {formatM2Tenths(total)}, but the design total says {formatM2Tenths(totals.grossFloorAreaM2)}. Treat these
          figures with caution and report the plot you drew.
        </p>
      ) : null}
      <dl className="facts facts--split">
        <div className="facts__row">
          <dt>Main use</dt>
          <dd className="num">{formatM2Tenths(totals.mainUseFloorAreaM2)}</dd>
        </div>
        <div className="facts__row">
          <dt>Parking</dt>
          <dd className="num">{formatM2Tenths(totals.parkingFloorAreaM2)}</dd>
        </div>
        <div className="facts__row">
          <dt>Sellable area</dt>
          <dd className="num">{formatM2Tenths(totals.sellableAreaM2)}</dd>
        </div>
      </dl>
    </section>
  );
}

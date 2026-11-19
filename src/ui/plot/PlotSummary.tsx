import type { NearestStation } from '../../site/context';
import { formatM2, formatMetres, formatRaiNganWah } from '../format';
import { CornerForm } from '../panel/CornerForm';
import type { PlotMeasure } from './plotMeasure';

export interface PlotSummaryProps {
  readonly measure: PlotMeasure;
  readonly station: NearestStation | null;
}

function stationText(station: NearestStation): string {
  const name = station.ref ? `${station.name} (${station.ref})` : station.name;
  const distance = formatMetres(station.distanceM, 0);
  return station.geomSource === 'node' ? `${name}, approximately ${distance}` : `${name}, ${distance}`;
}

/** Area, perimeter and nearest station, as a short schedule. */
export function PlotSummary({ measure, station }: PlotSummaryProps) {
  return (
    <section className="panel-section" aria-labelledby="plot-heading">
      <h2 id="plot-heading" className="panel-section__title" tabIndex={-1}>
        Your plot
      </h2>
      <dl className="facts">
        <div className="facts__row facts__row--lead">
          <dt>Area</dt>
          <dd>
            <span className="figure">{formatM2(measure.areaM2)}</span>
            <span className="facts__aside">{formatRaiNganWah(measure.areaM2)}</span>
          </dd>
        </div>
        <div className="facts__row">
          <dt>Perimeter</dt>
          <dd className="num">{formatMetres(measure.perimeterM)}</dd>
        </div>
        <div className="facts__row">
          <dt>Nearest station</dt>
          <dd>{station ? stationText(station) : 'Not known'}</dd>
        </div>
      </dl>
      <CornerForm />
    </section>
  );
}

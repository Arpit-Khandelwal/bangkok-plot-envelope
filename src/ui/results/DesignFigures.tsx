import type { Design, RegimeRules } from '../../core/types';
import { asSentence, formatM2, formatMetres, formatNumber, formatPercent, formatRatio } from '../format';

export interface DesignFiguresProps {
  readonly design: Design;
  readonly regime: RegimeRules;
  readonly plotAreaM2: number;
}

interface Figure {
  readonly label: string;
  readonly value: string;
  readonly aside?: string;
}

function figures(design: Design, regime: RegimeRules, plotAreaM2: number): Figure[] {
  const totals = design.totals;
  const allowedFar = plotAreaM2 > 0 ? regime.maxGfaM2 / plotAreaM2 : null;
  return [
    { label: 'Floor area ratio', value: formatRatio(totals.far), aside: allowedFar === null ? undefined : `of ${formatRatio(allowedFar)} allowed here` },
    { label: 'Storeys', value: formatNumber(totals.storeys) },
    { label: 'Roof deck', value: formatMetres(totals.roofDeckHeightM), aside: `top ${formatMetres(totals.topHeightM)}` },
    { label: 'Units', value: formatNumber(totals.units) },
    { label: 'Parking spaces', value: formatNumber(totals.parkingProvided), aside: `${formatNumber(totals.parkingRequired)} required` },
    { label: 'Coverage', value: formatM2(totals.coverageM2), aside: plotAreaM2 > 0 ? `${formatPercent(totals.coverageM2 / plotAreaM2, 0)} of plot` : undefined },
    { label: 'Open space', value: formatM2(totals.openSpaceM2) },
  ];
}

/** The headline floor area, the key figures, and the rule that stops more floor area. */
export function DesignFigures({ design, regime, plotAreaM2 }: DesignFiguresProps) {
  const binding = regime.rules.find((rule) => rule.id === regime.bindingGfaRuleId);

  return (
    <section className="panel-section" aria-labelledby="figures-heading">
      <h2 id="figures-heading" className="visually-hidden">
        {design.name} in figures
      </h2>
      <p className="headline">
        <span className="headline__label">Total floor area</span>
        <span className="headline__value">{formatM2(design.totals.grossFloorAreaM2)}</span>
        <span className="headline__aside">Limit here: {formatM2(regime.maxGfaM2)}</span>
      </p>
      <dl className="figures">
        {figures(design, regime, plotAreaM2).map((figure) => (
          <div key={figure.label} className="figures__item">
            <dt>{figure.label}</dt>
            <dd>
              <span className="figures__value">{figure.value}</span>
              {figure.aside ? <span className="figures__aside">{figure.aside}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {binding ? (
        <p className="binding">
          <strong>{binding.title}</strong> is what stops more floor area. {asSentence(binding.requirement)}
        </p>
      ) : null}
    </section>
  );
}

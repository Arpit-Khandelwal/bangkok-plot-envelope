import { HIGH_RISE_ROOF_DECK_M } from '../../core/checks/area';
import { mVs } from '../../core/rules/format';
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

const AREA_TOLERANCE_M2 = 0.5;
const SHARE_NOTE_THRESHOLD = 0.6;

/** The share of allowed space the design fills, as a whole percentage held to 0 to 100. */
export function spaceShareSentences(share: number): string {
  const clamped = Number.isFinite(share) ? Math.min(Math.max(share, 0), 1) : 0;
  const first = `This design fills ${formatPercent(clamped, 0)} of the allowed space.`;
  if (clamped >= SHARE_NOTE_THRESHOLD) return first;
  return `${first} The allowed space is larger than the building because floor-area limits, not the outline, are what stop it growing.`;
}

function keyFigures(design: Design): Figure[] {
  const totals = design.totals;
  return [
    { label: 'Storeys', value: formatNumber(totals.storeys) },
    { label: 'Height', value: formatMetres(totals.topHeightM) },
    { label: 'Units', value: formatNumber(totals.units) },
  ];
}

function otherFigures(design: Design, plotAreaM2: number): Figure[] {
  const totals = design.totals;
  return [
    { label: 'Floor area ratio (FAR)', value: formatRatio(totals.far), aside: totals.allowedFar > 0 ? `of ${formatRatio(totals.allowedFar)} allowed by the plan` : undefined },
    // Shown so it never contradicts the 23 m high-rise threshold: 22.999 m reads 22.99 m, not 23 m.
    { label: 'Roof deck', value: mVs(totals.roofDeckHeightM, HIGH_RISE_ROOF_DECK_M, 1).value },
    { label: 'Parking spaces', value: formatNumber(totals.parkingProvided), aside: `${formatNumber(totals.parkingRequired)} required` },
    { label: 'Coverage', value: formatM2(totals.coverageM2), aside: plotAreaM2 > 0 ? `${formatPercent(totals.coverageM2 / plotAreaM2, 0)} of plot` : undefined },
    { label: 'Open space', value: formatM2(totals.openSpaceM2) },
    { label: 'Sellable area (assumed efficiency)', value: formatM2(totals.sellableAreaM2) },
  ];
}

/** The headline floor area, the key figures, and the rule that stops more floor area. */
export function DesignFigures({ design, regime, plotAreaM2 }: DesignFiguresProps) {
  const sameArea = Math.abs(design.totals.grossFloorAreaM2 - design.totals.farFloorAreaM2) <= AREA_TOLERANCE_M2;
  const binding = regime.rules.find((rule) => rule.id === regime.bindingGfaRuleId);

  return (
    <section className="panel-section" aria-labelledby="figures-heading">
      <h2 id="figures-heading" className="visually-hidden">
        {design.name} in figures
      </h2>
      <p className="headline">
        <span className="headline__label">{sameArea ? 'Floor area' : 'Floor area counted toward the floor area ratio (FAR)'}</span>
        <span className="headline__value">{formatM2(design.totals.farFloorAreaM2)}</span>
        <span className="headline__aside">Limit here: {formatM2(regime.maxGfaM2)}</span>
        {sameArea ? null : (
          <span className="headline__aside">Total floor area built: {formatM2(design.totals.grossFloorAreaM2)}</span>
        )}
      </p>
      <p className="headline__note">{spaceShareSentences(design.totals.envelopeVolumeShare)}</p>
      <dl className="key-figures">
        {keyFigures(design).map((figure) => (
          <div key={figure.label} className="key-figures__item">
            <dt>{figure.label}</dt>
            <dd>{figure.value}</dd>
          </div>
        ))}
      </dl>
      <dl className="figure-list">
        {otherFigures(design, plotAreaM2).map((figure) => (
          <div key={figure.label} className="figure-list__row">
            <dt>{figure.label}</dt>
            <dd>
              <span className="figure-list__value">{figure.value}</span>
              {figure.aside ? <span className="figure-list__aside">{figure.aside}</span> : null}
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

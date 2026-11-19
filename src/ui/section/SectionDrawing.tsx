import { useId } from 'react';
import type { SectionProfile } from '../../core/types';
import { formatMetres, formatNumber } from '../format';
import { Dimension } from './Dimension';
import { clampLabelX, estimateTextWidth, layoutSection, SECTION_MARGIN_X } from './sectionGeometry';

const LABEL_SIZE = 11;
const ROAD_ROW = 16;
const SETBACK_ROW = 38;
const SCALE_BAR_M = 10;
const ROAD_BAND = 5;

export interface SectionDrawingProps {
  readonly profile: SectionProfile;
  /** The road edge's letter as drawn (from its `sourceIndex`), e.g. "A". */
  readonly roadEdgeLetter: string;
}

function describe(profile: SectionProfile, roadEdgeLetter: string): string {
  const nearest = profile.floors.reduce((near, floor) => Math.min(near, floor.nearM), Number.POSITIVE_INFINITY);
  const top = profile.floors.reduce((height, floor) => Math.max(height, floor.topM), 0);
  const parts = [
    `Cut at right angles to edge ${roadEdgeLetter}.`,
    `The road is ${formatMetres(profile.rowWidthM)} wide and the required setback is ${formatMetres(profile.setbackM)}.`,
    profile.floors.length > 0
      ? `The building has ${new Set(profile.floors.map((floor) => floor.level)).size} floors, its front face ${formatMetres(nearest)} from the plot edge and its roof at ${formatMetres(top)}.`
      : 'No floors are drawn.',
    `The height limit rises ${formatNumber(profile.slope, 2)} m for every metre away from the far side of the road.`,
  ];
  if (profile.roofDeckCapM !== null) parts.push(`A dashed line marks ${formatMetres(profile.roofDeckCapM)}, where High-rise rules start.`);
  return parts.join(' ');
}

/** A to-scale vertical cut from the far side of the road through the building. */
export function SectionDrawing({ profile, roadEdgeLetter }: SectionDrawingProps) {
  const titleId = useId();
  const descId = useId();
  const layout = layoutSection(profile);
  const { toX, toY, groundY, width } = layout;

  const roadLabel = `Road width ${formatMetres(profile.rowWidthM)}`;
  const setbackLabel = `Setback ${formatMetres(profile.setbackM)} from the plot edge`;
  const capLabel = profile.roofDeckCapM === null ? '' : `${formatNumber(profile.roofDeckCapM, 1)} m: High-rise rules start here`;
  const limitLabel = 'Height limit';
  const labelRoomLeft = layout.limitEnd.x - SECTION_MARGIN_X;
  const limitLabelFitsLeft = labelRoomLeft > estimateTextWidth(limitLabel, LABEL_SIZE) + 8;
  const limitLabelY = Math.max(layout.limitEnd.y + 14, toY(layout.heightMaxM) + 12);
  const scaleBarEnd = width - SECTION_MARGIN_X;
  const scaleBarStart = scaleBarEnd - SCALE_BAR_M * layout.scale;

  return (
    <svg
      className="section"
      viewBox={`0 0 ${width} ${layout.height}`}
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <title id={titleId}>Section through the plot and the road</title>
      <desc id={descId}>{describe(profile, roadEdgeLetter)}</desc>

      <rect className="section__road" x={toX(-profile.rowWidthM)} y={groundY} width={profile.rowWidthM * layout.scale} height={ROAD_BAND} />
      <line className="section__ground" x1={toX(layout.xMinM)} y1={groundY} x2={toX(layout.xMaxM)} y2={groundY} />
      <line className="section__plot" x1={toX(0)} y1={groundY} x2={toX(profile.plotDepthM)} y2={groundY} />
      <line className="section__boundary" x1={toX(0)} y1={groundY + SETBACK_ROW} x2={toX(0)} y2={toY(4)} />
      <line className="section__boundary" x1={toX(-profile.rowWidthM)} y1={groundY + ROAD_ROW} x2={toX(-profile.rowWidthM)} y2={toY(2)} />

      {profile.floors.map((floor) => (
        <rect
          key={`${floor.level}-${floor.use}`}
          className={`section__floor section__floor--${floor.use}`}
          x={toX(floor.nearM)}
          y={toY(floor.topM)}
          width={Math.max(0, (floor.farM - floor.nearM) * layout.scale)}
          height={Math.max(0, (floor.topM - floor.baseM) * layout.scale)}
        />
      ))}

      {profile.roofDeckCapM !== null ? (
        <g className="section__cap">
          <line x1={toX(layout.xMinM)} y1={toY(profile.roofDeckCapM)} x2={toX(layout.xMaxM)} y2={toY(profile.roofDeckCapM)} />
          <text x={width - SECTION_MARGIN_X} y={toY(profile.roofDeckCapM) - 5} textAnchor="end" className="section__label section__label--halo">
            {capLabel}
          </text>
        </g>
      ) : null}

      <g className="section__limit">
        <line x1={layout.limitStart.x} y1={layout.limitStart.y} x2={layout.limitEnd.x} y2={layout.limitEnd.y} />
        <text
          x={limitLabelFitsLeft ? layout.limitEnd.x - 8 : layout.limitEnd.x + 8}
          y={limitLabelY}
          textAnchor={limitLabelFitsLeft ? 'end' : 'start'}
          className="section__label section__label--limit section__label--halo"
        >
          {limitLabel}
        </text>
      </g>

      <Dimension
        x1={toX(-profile.rowWidthM)}
        x2={toX(0)}
        y={groundY + ROAD_ROW}
        label={roadLabel}
        labelX={clampLabelX(toX(-profile.rowWidthM / 2), roadLabel, LABEL_SIZE, width)}
        anchor="middle"
      />
      <Dimension x1={toX(0)} x2={toX(profile.setbackM)} y={groundY + SETBACK_ROW} label={setbackLabel} labelX={toX(0)} anchor="start" />

      <g className="section__dimension">
        <line x1={scaleBarStart} y1={groundY + ROAD_ROW} x2={scaleBarEnd} y2={groundY + ROAD_ROW} />
        <line x1={scaleBarStart} y1={groundY + ROAD_ROW - 4} x2={scaleBarStart} y2={groundY + ROAD_ROW + 4} />
        <line x1={scaleBarEnd} y1={groundY + ROAD_ROW - 4} x2={scaleBarEnd} y2={groundY + ROAD_ROW + 4} />
        <text x={scaleBarEnd} y={groundY + ROAD_ROW + 13} textAnchor="end" className="section__label">
          {`${SCALE_BAR_M} m`}
        </text>
      </g>
    </svg>
  );
}

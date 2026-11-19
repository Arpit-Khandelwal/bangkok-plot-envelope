const TICK = 4;
const LABEL_GAP = 13;

export interface DimensionProps {
  readonly x1: number;
  readonly x2: number;
  readonly y: number;
  readonly label: string;
  readonly labelX: number;
  readonly anchor: 'start' | 'middle' | 'end';
}

/** A horizontal dimension line with end ticks and a label below it. */
export function Dimension({ x1, x2, y, label, labelX, anchor }: DimensionProps) {
  return (
    <g className="section__dimension">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - TICK} x2={x1} y2={y + TICK} />
      <line x1={x2} y1={y - TICK} x2={x2} y2={y + TICK} />
      <text x={labelX} y={y + LABEL_GAP} textAnchor={anchor} className="section__label">
        {label}
      </text>
    </g>
  );
}

import { useEffect, useRef } from 'react';
import type { EdgeSpec } from '../../core/types';
import { edgeLetter } from '../../map/edgeLabels';
import { MAX_ROAD_WIDTH_M, MIN_ROAD_WIDTH_M } from '../../state/defaults';
import { NumberField } from '../common/NumberField';
import { formatMetres } from '../format';
import { prefersReducedMotion } from '../motion';
import { KIND_OPTIONS, roadEdgeCount } from './edgeChoices';
import type { EdgeKind } from './edgeChoices';
import { RoadChoice } from './RoadChoice';

const MAX_CANAL_WIDTH_M = 200;

export interface EdgeRowProps {
  readonly index: number;
  readonly edges: readonly EdgeSpec[];
  readonly lengthM: number | null;
  readonly isSelected: boolean;
  readonly onSelect: (index: number) => void;
  readonly onKindChange: (index: number, kind: EdgeKind) => void;
  readonly onSpecChange: (index: number, spec: EdgeSpec) => void;
  readonly onRoadWidthChange: (roadId: string, widthM: number) => void;
}

export function EdgeRow({ index, edges, lengthM, isSelected, onSelect, onKindChange, onSpecChange, onRoadWidthChange }: EdgeRowProps) {
  const rowRef = useRef<HTMLLIElement>(null);
  const spec: EdgeSpec = edges[index] ?? { kind: 'neighbour' };
  const letter = edgeLetter(index);

  useEffect(() => {
    if (!isSelected) return;
    rowRef.current?.scrollIntoView?.({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [isSelected]);

  return (
    <li
      ref={rowRef}
      className={`edge-row${isSelected ? ' edge-row--selected' : ''}`}
      onFocusCapture={() => {
        if (!isSelected) onSelect(index);
      }}
    >
      <button type="button" className="edge-row__select" aria-pressed={isSelected} onClick={() => onSelect(index)}>
        <span className={`edge-row__letter edge-row__letter--${spec.kind}`}>{letter}</span>
        <span className="edge-row__length">
          <span className="visually-hidden">Edge {letter}, </span>
          {lengthM === null ? 'Length unknown' : formatMetres(lengthM)}
        </span>
      </button>

      <fieldset className="segmented segmented--compact edge-row__kind">
        <legend className="visually-hidden">What lies beyond edge {letter}</legend>
        <span className="segmented__options">
          {KIND_OPTIONS.map((option) => (
            <label key={option.value} className="segmented__option">
              <input
                type="radio"
                className="segmented__input"
                name={`edge-kind-${index}`}
                value={option.value}
                checked={spec.kind === option.value}
                onChange={() => onKindChange(index, option.value)}
              />
              <span className="segmented__label">{option.label}</span>
            </label>
          ))}
        </span>
      </fieldset>

      {spec.kind === 'road' ? (
        <div className="edge-row__details">
          <NumberField
            label="Road width (right of way)"
            hint="The full width between the property lines on both sides, including footpaths. The starting value is a guess: enter the measured width."
            value={spec.rowWidthM}
            unit="m"
            min={MIN_ROAD_WIDTH_M}
            max={MAX_ROAD_WIDTH_M}
            maxDecimals={1}
            onCommit={(widthM) => onRoadWidthChange(spec.roadId, widthM)}
          />
          {roadEdgeCount(edges) > 1 ? <RoadChoice index={index} edges={edges} onChange={(next) => onSpecChange(index, next)} /> : null}
        </div>
      ) : null}

      {spec.kind === 'waterway' ? (
        <div className="edge-row__details">
          <NumberField
            label="Canal width"
            hint="Water surface width, bank to bank."
            value={spec.widthM}
            unit="m"
            min={1}
            max={MAX_CANAL_WIDTH_M}
            maxDecimals={1}
            onCommit={(widthM) => onSpecChange(index, { kind: 'waterway', widthM })}
          />
        </div>
      ) : null}
    </li>
  );
}

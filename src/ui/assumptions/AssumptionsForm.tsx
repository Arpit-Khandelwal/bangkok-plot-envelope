import type { Assumptions } from '../../core/types';
import { useAppStore } from '../../state/store';
import { NumberField } from '../common/NumberField';
import { InterpretationSwitches } from './InterpretationSwitches';

interface AssumptionField {
  readonly key: keyof Assumptions;
  readonly label: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  /** Shares are stored from 0 to 1 and shown as percentages. */
  readonly isShare?: boolean;
}

const FIELDS: readonly AssumptionField[] = [
  { key: 'floorToFloorM', label: 'Floor-to-floor height', unit: 'm', min: 2.6, max: 8 },
  { key: 'parkingFloorToFloorM', label: 'Parking floor-to-floor height', unit: 'm', min: 2.4, max: 6 },
  { key: 'efficiency', label: 'Sellable share of non-parking floor area', unit: '%', min: 30, max: 100, isShare: true },
  { key: 'averageUnitM2', label: 'Average unit size', unit: 'm²', min: 20, max: 2000 },
  { key: 'shareOfUnitsOver60M2', label: 'Units of 60 m² or more', unit: '%', min: 0, max: 100, isShare: true },
  { key: 'parkingM2PerStall', label: 'Parking floor area per car, with aisles and ramps', unit: 'm²', min: 20, max: 60 },
  { key: 'parapetM', label: 'Parapet and rooftop structure', unit: 'm', min: 0, max: 10 },
];

const PERCENT = 100;

/** Developer norms, editable, kept apart from the law. Collapsed by default. */
export function AssumptionsForm() {
  const assumptions = useAppStore((state) => state.assumptions);
  const setAssumption = useAppStore((state) => state.setAssumption);

  return (
    <details className="panel-section disclosure" aria-label="Assumptions (not law)">
      <summary className="disclosure__summary">
        <span className="panel-section__title">Assumptions (not law)</span>
      </summary>
      <div className="disclosure__body">
        <p className="panel-section__lede">Industry norms used to turn allowed space into floors and units. Change them to match your scheme.</p>
        <div className="field-grid">
          {FIELDS.map((field) => {
            const stored = assumptions[field.key];
            return (
              <NumberField
                key={field.key}
                label={field.label}
                unit={field.unit}
                min={field.min}
                max={field.max}
                value={field.isShare ? Math.round(stored * PERCENT * 10) / 10 : stored}
                onCommit={(value) => setAssumption(field.key, field.isShare ? value / PERCENT : value)}
              />
            );
          })}
        </div>
        <InterpretationSwitches />
      </div>
    </details>
  );
}

import type { BuildingType } from '../../core/types';
import { useAppStore } from '../../state/store';

const OPTIONS: readonly { readonly value: BuildingType; readonly label: string }[] = [
  { value: 'condo', label: 'Condominium' },
  { value: 'office', label: 'Office' },
];

/** Two-option segmented control built from native radio buttons. */
export function BuildingTypeControl() {
  const buildingType = useAppStore((state) => state.buildingType);
  const setBuildingType = useAppStore((state) => state.setBuildingType);

  return (
    <fieldset className="segmented">
      <legend className="segmented__legend">Building type</legend>
      <span className="segmented__options">
        {OPTIONS.map((option) => (
          <label key={option.value} className="segmented__option">
            <input
              type="radio"
              name="building-type"
              value={option.value}
              checked={buildingType === option.value}
              onChange={() => setBuildingType(option.value)}
              className="segmented__input"
            />
            <span className="segmented__label">{option.label}</span>
          </label>
        ))}
      </span>
    </fieldset>
  );
}

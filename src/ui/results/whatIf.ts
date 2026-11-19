import { useAppStore } from '../../state/store';

/** True when the result is not a plain compliance result: rules are off or a setting is read less cautiously. */
export function isWhatIfState(disabledRuleCount: number, nonDefaultReadings: readonly string[]): boolean {
  return disabledRuleCount > 0 || nonDefaultReadings.length > 0;
}

/** Whether the what-if notice is showing, so a "Pass" must carry its qualifier. */
export function useIsWhatIf(nonDefaultReadings: readonly string[]): boolean {
  const disabledCount = useAppStore((state) => state.disabledRuleIds.length);
  return isWhatIfState(disabledCount, nonDefaultReadings);
}

export const QUALIFIED_PASS_WORD = 'Passes under this reading';

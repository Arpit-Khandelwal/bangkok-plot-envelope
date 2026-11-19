/**
 * The readings of unclear law (DECISIONS.md section B) and their defaults, in one table shared by
 * the core and the app state, so the two cannot drift. A reading the user has moved off its default
 * toward the less conservative side is named in a plain sentence on the evaluation
 * (`nonDefaultReadings`); one moved toward the stricter side is not a what-if and is not listed.
 */
import type { Interpretation } from './types';

/**
 * The defaults. The two parking readings default to the conservative side; the front open space
 * defaults to our reading of the text (DECISIONS.md B12), with the stricter reading as a setting.
 */
export const DEFAULT_INTERPRETATION: Interpretation = {
  parkingCountsInFar: true,
  officeParkingCountsInOperatingArea: true,
  frontOpenSpaceOnPublicRoad: false,
};

/** For each setting: the value that is less conservative, and what it means, or null when no value is. */
const LENIENT: Readonly<Record<keyof Interpretation, { readonly value: boolean; readonly sentence: string } | null>> = {
  parkingCountsInFar: { value: false, sentence: 'Parking floors are not counted toward the floor area ratio.' },
  officeParkingCountsInOperatingArea: {
    value: false,
    sentence: "An office's own parking floors are not counted in its operating area for the plan's office size limit.",
  },
  // The default is already the lenient side; the only other value is stricter.
  frontOpenSpaceOnPublicRoad: null,
};

const KEYS = Object.keys(DEFAULT_INTERPRETATION) as ReadonlyArray<keyof Interpretation>;

/** One sentence per setting moved off its default to the less conservative side, in a fixed order. */
export function nonDefaultReadings(interpretation: Interpretation): readonly string[] {
  return KEYS.flatMap((k) => {
    const lenient = LENIENT[k];
    const moved = interpretation[k] !== DEFAULT_INTERPRETATION[k];
    return lenient !== null && moved && interpretation[k] === lenient.value ? [lenient.sentence] : [];
  });
}

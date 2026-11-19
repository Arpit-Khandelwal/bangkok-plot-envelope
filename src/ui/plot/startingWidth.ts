import type { RoadWidthSuggestion } from '../../site/roadWidth';
import { formatMetres } from '../format';

/** Where a road's starting width came from, kept until the user edits it. */
export interface StartingWidth {
  readonly widthM: number;
  /** Null when the value is the constant placeholder. */
  readonly suggestion: RoadWidthSuggestion | null;
}

/** One line telling the user where the starting road width came from. */
export function startingWidthNote({ widthM, suggestion }: StartingWidth): string {
  const width = formatMetres(widthM);
  if (!suggestion) return `Starting value ${width} is a placeholder. Enter the measured width.`;
  const from = suggestion.roadName ? ` for ${suggestion.roadName}` : '';
  const how = suggestion.source === 'tag' ? 'taken from a width tagged in map data' : 'estimated from map data';
  return `Starting value ${width}, ${how}${from}. Enter the measured width.`;
}

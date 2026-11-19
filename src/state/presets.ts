import type { PlotPreset } from './store';

/** A real plot the user can load to see the tool work without drawing. */
export interface NamedPlotPreset extends PlotPreset {
  readonly id: string;
  readonly label: string;
  /** One line on what makes this plot interesting. */
  readonly description: string;
}

/** Filled by the presets task with surveyed plots in zone ย.7. The menu is hidden while empty. */
export const PRESETS: readonly NamedPlotPreset[] = [];

/**
 * Moves focus to the first element matching `selector`, after React has committed the update
 * that made the old focus target disappear or the new one appear.
 */
export function focusSoon(selector: string): void {
  window.setTimeout(() => {
    document.querySelector<HTMLElement>(selector)?.focus();
  }, 0);
}

export const PLOT_HEADING_SELECTOR = '#plot-heading';
export const RULES_HEADING_SELECTOR = '#rules-heading';
export const EXAMPLES_SUMMARY_SELECTOR = '.presets__summary';

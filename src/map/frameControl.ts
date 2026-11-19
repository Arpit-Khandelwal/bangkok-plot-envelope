import type { IControl, Map as MapLibreMap, NavigationControl } from 'maplibre-gl';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const FRAME_PLOT_LABEL = 'Frame plot';

/** Four corner brackets around a small square: "fit this in view". */
function frameIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const brackets = document.createElementNS(SVG_NS, 'path');
  brackets.setAttribute('d', 'M3 7.5V3h4.5M12.5 3H17v4.5M17 12.5V17h-4.5M7.5 17H3v-4.5');
  brackets.setAttribute('fill', 'none');
  brackets.setAttribute('stroke', 'currentColor');
  brackets.setAttribute('stroke-width', '1.8');
  const plot = document.createElementNS(SVG_NS, 'rect');
  plot.setAttribute('x', '7');
  plot.setAttribute('y', '7');
  plot.setAttribute('width', '6');
  plot.setAttribute('height', '6');
  plot.setAttribute('fill', 'currentColor');
  svg.append(brackets, plot);
  return svg;
}

export function createFrameButton(onFrame: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('map-frame-plot');
  button.title = FRAME_PLOT_LABEL;
  button.setAttribute('aria-label', FRAME_PLOT_LABEL);
  button.append(frameIcon());
  button.addEventListener('click', () => onFrame());
  return button;
}

/**
 * MapLibre's zoom and compass group with a "Frame plot" button appended, so all camera buttons
 * share one group. It wraps the navigation control instead of reaching into its internals.
 */
export class NavigationWithFrameControl implements IControl {
  readonly button: HTMLButtonElement;

  constructor(
    private readonly navigation: NavigationControl,
    onFrame: () => void,
  ) {
    this.button = createFrameButton(onFrame);
  }

  onAdd(map: MapLibreMap): HTMLElement {
    const container = this.navigation.onAdd(map);
    container.append(this.button);
    return container;
  }

  onRemove(): void {
    this.navigation.onRemove();
  }

  /** The button is disabled while there is no plot to frame. */
  setEnabled(isEnabled: boolean): void {
    this.button.disabled = !isEnabled;
  }
}

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { collapseAttribution } from './attribution';

describe('collapseAttribution', () => {
  it('closes an open compact attribution but keeps the control and its button', () => {
    const container = document.createElement('div');
    container.innerHTML =
      '<details class="maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact maplibregl-compact-show" open>' +
      '<summary class="maplibregl-ctrl-attrib-button"></summary><div class="maplibregl-ctrl-attrib-inner">© OpenStreetMap</div></details>';
    collapseAttribution(container);
    const control = container.querySelector('.maplibregl-ctrl-attrib');
    expect(control).not.toBeNull();
    expect(control?.classList.contains('maplibregl-compact')).toBe(true);
    expect(control?.classList.contains('maplibregl-compact-show')).toBe(false);
    expect(container.querySelector('.maplibregl-ctrl-attrib-button')).not.toBeNull();
  });
});

// @vitest-environment jsdom
import type { Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { exposeDebugHandle, isDebugEnabled, type DebugTarget } from './debugHandle';
import { createFrameButton, FRAME_PLOT_LABEL, NavigationWithFrameControl } from './frameControl';

describe('frame plot button', () => {
  it('is an accessible button with a title and an icon', () => {
    const onFrame = vi.fn();
    const button = createFrameButton(onFrame);
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe(FRAME_PLOT_LABEL);
    expect(button.title).toBe(FRAME_PLOT_LABEL);
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    button.click();
    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  it('joins the navigation control group and can be disabled', () => {
    const group = document.createElement('div');
    const zoomIn = document.createElement('button');
    group.append(zoomIn);
    const onRemove = vi.fn();
    const navigation = { onAdd: () => group, onRemove } as unknown as NavigationControl;
    const control = new NavigationWithFrameControl(navigation, () => undefined);

    const container = control.onAdd({} as MapLibreMap);
    expect(container).toBe(group);
    expect(group.lastElementChild).toBe(control.button);

    control.setEnabled(false);
    expect(control.button.disabled).toBe(true);
    control.setEnabled(true);
    expect(control.button.disabled).toBe(false);

    control.onRemove();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('debug handle', () => {
  const map = {} as MapLibreMap;

  it('is exposed only with the debug query parameter', () => {
    expect(isDebugEnabled('?debug')).toBe(true);
    expect(isDebugEnabled('?preset=a&debug=1')).toBe(true);
    expect(isDebugEnabled('')).toBe(false);
    expect(isDebugEnabled('?debugging')).toBe(false);
  });

  it('sets and removes window.__buildable', () => {
    const target: DebugTarget = {};
    const remove = exposeDebugHandle(target, '?debug', map);
    expect(target.__buildable?.map).toBe(map);
    remove();
    expect(target.__buildable).toBeUndefined();
  });

  it('leaves the target untouched without the parameter', () => {
    const target: DebugTarget = {};
    exposeDebugHandle(target, '?other', map);
    expect('__buildable' in target).toBe(false);
  });
});

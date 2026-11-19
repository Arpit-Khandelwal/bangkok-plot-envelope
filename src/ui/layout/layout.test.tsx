// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Legend } from '../legend/Legend';
import { SiteBar } from '../sitebar/SiteBar';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubPhone(isPhone: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isPhone,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/** The body of the first rule whose selector list contains `selector`, inside the desktop media block. */
function desktopRule(css: string, selector: string): string {
  const block = css.slice(css.indexOf('@media (min-width: 900px)'));
  const match = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{([^}]*)\\}`).exec(block);
  return match?.[1] ?? '';
}

describe('desktop page layout (global.css)', () => {
  const css = readFileSync(resolve(__dirname, '../../styles/global.css'), 'utf8');

  it('clips html, body and the app root to one viewport', () => {
    const rule = desktopRule(css, 'html');
    expect(rule).toContain('height: 100dvh');
    expect(rule).toContain('overflow: hidden');
    expect(desktopRule(css, '.app')).toContain('overflow: clip');
  });

  it('makes the panel the only scroll container', () => {
    const rule = desktopRule(css, '.panel');
    expect(rule).toContain('overflow-y: auto');
    expect(rule).toContain('overscroll-behavior: contain');
  });
});

describe('phone layout', () => {
  it('collapses the legend into a closed disclosure', () => {
    stubPhone(true);
    const { container } = render(<Legend />);
    const details = container.querySelector('details.legend');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
    expect(screen.getByText('What the colours mean')).toBeTruthy();
  });

  it('keeps the legend a plain block on desktop', () => {
    stubPhone(false);
    const { container } = render(<Legend />);
    expect(container.querySelector('details')).toBeNull();
    expect(screen.getByLabelText('Map key')).toBeTruthy();
  });

  it('puts the examples menu behind a More disclosure', () => {
    stubPhone(true);
    const { container } = render(<SiteBar zoneLookup={null} dataStatus={{ state: 'ready' }} />);
    expect(container.querySelector('details.site-bar__more .presets')).not.toBeNull();
    expect(container.querySelector('.site-bar__more')?.hasAttribute('open')).toBe(false);
  });

  it('always renders the zone code and keeps the full building-type names for assistive tech', () => {
    stubPhone(true);
    const zone = { status: 'single', zone: { code: 'ย.7', planVersion: '2556' } } as const;
    const { container } = render(<SiteBar zoneLookup={zone} dataStatus={{ state: 'ready' }} />);
    const code = container.querySelector('.zone-chip__code');
    expect(code?.textContent).toBe('ย.7');
    expect(code?.classList.contains('thai')).toBe(true);
    expect(screen.getByRole('radio', { name: 'Condominium' })).toBeTruthy();
    expect(container.querySelector('.segmented__short')?.textContent).toBe('Condo');
  });
});

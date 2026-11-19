// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { revealInPanel, scrollTopToReveal } from './scrollIntoPanel';

describe('scrollTopToReveal', () => {
  it('returns null when the row is fully visible', () => {
    expect(scrollTopToReveal(0, 400, 50, 150, 30)).toBeNull();
  });
  it('scrolls up just enough for a row above', () => {
    expect(scrollTopToReveal(100, 500, 60, 160, 200)).toBe(160);
  });
  it('scrolls down just enough for a row below', () => {
    expect(scrollTopToReveal(100, 500, 450, 530, 200)).toBe(230);
  });
  it('keeps the top of a row taller than the container in view', () => {
    expect(scrollTopToReveal(0, 100, 20, 400, 0)).toBe(20);
  });
});

describe('revealInPanel', () => {
  const rect = (top: number, bottom: number): DOMRect => ({ top, bottom }) as DOMRect;

  it('adjusts the panel scrollTop and never calls scrollIntoView', () => {
    document.body.innerHTML = '<div class="panel"><ul><li id="row"></li></ul></div>';
    const panel = document.querySelector<HTMLElement>('.panel') as HTMLElement;
    const row = document.getElementById('row') as HTMLElement;
    let called = false;
    row.scrollIntoView = () => {
      called = true;
    };
    panel.getBoundingClientRect = () => rect(0, 300);
    row.getBoundingClientRect = () => rect(280, 340);
    revealInPanel(row);
    expect(panel.scrollTop).toBe(40);
    expect(called).toBe(false);
  });

  it('does nothing without a panel', () => {
    document.body.innerHTML = '<ul><li id="row"></li></ul>';
    expect(() => revealInPanel(document.getElementById('row') as HTMLElement)).not.toThrow();
  });
});

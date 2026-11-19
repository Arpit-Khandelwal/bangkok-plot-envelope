/** Scroll offset that brings [top, bottom] fully into a container's viewport, or null if it already is. */
export function scrollTopToReveal(
  containerTop: number,
  containerBottom: number,
  rowTop: number,
  rowBottom: number,
  currentScrollTop: number,
): number | null {
  if (rowTop < containerTop) return currentScrollTop - (containerTop - rowTop);
  if (rowBottom > containerBottom) {
    // Never push the row's top out of view when it is taller than the container.
    const shift = Math.min(rowBottom - containerBottom, rowTop - containerTop);
    return currentScrollTop + shift;
  }
  return null;
}

/** Scrolls only the nearest `.panel` container, never the document. Does nothing if the row is visible or no panel exists. */
export function revealInPanel(row: HTMLElement): void {
  const panel = row.closest<HTMLElement>('.panel');
  if (!panel) return;
  const container = panel.getBoundingClientRect();
  const box = row.getBoundingClientRect();
  const next = scrollTopToReveal(container.top, container.bottom, box.top, box.bottom, panel.scrollTop);
  if (next !== null) panel.scrollTop = next;
}

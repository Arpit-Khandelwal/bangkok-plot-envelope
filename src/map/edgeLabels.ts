import type { EdgeSpec } from '../core/types';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** A, B, ... Z, then A2, B2 ... so every edge of a many-cornered plot has a short name. */
export function edgeLetter(index: number): string {
  const letter = LETTERS[index % LETTERS.length] ?? '?';
  const round = Math.floor(index / LETTERS.length);
  return round === 0 ? letter : `${letter}${round + 1}`;
}

export function formatMetres(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} m`;
}

export function edgeSummary(spec: EdgeSpec): string {
  switch (spec.kind) {
    case 'road':
      return `Road ${formatMetres(spec.rowWidthM)}`;
    case 'waterway':
      return `Canal ${formatMetres(spec.widthM)}`;
    case 'neighbour':
      return 'Neighbour';
  }
}

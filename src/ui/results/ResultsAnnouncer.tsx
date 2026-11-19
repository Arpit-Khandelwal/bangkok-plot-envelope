import type { Design } from '../../core/types';
import { useDebouncedValue } from '../common/useDebouncedValue';

export const ANNOUNCE_DELAY_MS = 1000;

/** "Slender tower: 6 of 8 checks pass, 1 fail". */
export function resultsAnnouncement(design: Design, qualified = false): string {
  const total = design.checks.length;
  const passed = design.checks.filter((check) => check.status === 'pass').length;
  const failed = design.checks.filter((check) => check.status === 'fail').length;
  return `${design.name}: ${passed} of ${total} checks pass${qualified ? ' under this reading' : ''}${failed > 0 ? `, ${failed} fail` : ''}`;
}

export interface ResultsAnnouncerProps {
  readonly design: Design;
  readonly qualified?: boolean;
}

/**
 * One visually hidden status line. Results recompute while a value is dragged or typed, so the
 * text is announced only once it has stopped changing for a second.
 */
export function ResultsAnnouncer({ design, qualified = false }: ResultsAnnouncerProps) {
  const text = useDebouncedValue(resultsAnnouncement(design, qualified), ANNOUNCE_DELAY_MS);
  return (
    <p className="visually-hidden" role="status">
      {text}
    </p>
  );
}

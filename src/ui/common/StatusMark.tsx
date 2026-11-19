import type { CheckStatus } from '../../core/types';

export const STATUS_WORDS: Readonly<Record<CheckStatus, string>> = {
  pass: 'Pass',
  fail: 'Fail',
  warn: 'Check on site',
  info: 'Note',
};

export interface StatusMarkProps {
  readonly status: CheckStatus;
}

/** Each status has its own shape and word, so colour is never the only signal. */
function StatusShape({ status }: StatusMarkProps) {
  switch (status) {
    case 'pass':
      return (
        <svg viewBox="0 0 16 16" className="status-mark__icon" aria-hidden="true">
          <circle cx="8" cy="8" r="7" />
          <path d="M4.6 8.3l2.2 2.2 4.6-4.8" className="status-mark__glyph" />
        </svg>
      );
    case 'fail':
      return (
        <svg viewBox="0 0 16 16" className="status-mark__icon" aria-hidden="true">
          <rect x="1.5" y="1.5" width="13" height="13" rx="1" />
          <path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" className="status-mark__glyph" />
        </svg>
      );
    case 'warn':
      return (
        <svg viewBox="0 0 16 16" className="status-mark__icon" aria-hidden="true">
          <path d="M8 1.5l7 13H1z" />
          <path d="M8 6v4M8 11.6v.8" className="status-mark__glyph" />
        </svg>
      );
    case 'info':
      return (
        <svg viewBox="0 0 16 16" className="status-mark__icon status-mark__icon--outline" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7v4.5M8 4.4v.8" className="status-mark__glyph" />
        </svg>
      );
  }
}

export function StatusMark({ status }: StatusMarkProps) {
  return (
    <span className={`status-mark status-mark--${status}`}>
      <StatusShape status={status} />
      <span className="status-mark__word">{STATUS_WORDS[status]}</span>
    </span>
  );
}

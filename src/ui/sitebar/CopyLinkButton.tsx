import { useEffect, useRef, useState } from 'react';
import { writeHashNow } from '../../state/urlSync';
import { useAppStore } from '../../state/store';

export const COPIED_MESSAGE_MS = 2000;

type Status = 'idle' | 'copied' | 'manual';

/** Selects the link in a temporary input and asks the browser to copy it. Returns whether that worked. */
function copyBySelection(text: string): boolean {
  const input = document.createElement('input');
  input.value = text;
  input.readOnly = true;
  input.setAttribute('aria-hidden', 'true');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  let isCopied = false;
  try {
    isCopied = typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    isCopied = false;
  }
  document.body.removeChild(input);
  return isCopied;
}

/** Copies the current link. Disabled until a plot exists. */
export function CopyLinkButton() {
  const hasPlot = useAppStore((state) => state.plot !== null);
  const [status, setStatus] = useState<Status>('idle');
  const manualRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (status === 'manual') manualRef.current?.select();
  }, [status]);

  const show = (next: Status): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    setStatus(next);
    if (next === 'copied') timer.current = setTimeout(() => setStatus('idle'), COPIED_MESSAGE_MS);
  };

  const copy = async (): Promise<void> => {
    writeHashNow();
    const href = window.location.href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(href);
      show('copied');
    } catch {
      show(copyBySelection(href) ? 'copied' : 'manual');
    }
  };

  return (
    <span className="copy-link">
      <button type="button" className="button button--quiet" disabled={!hasPlot} onClick={() => void copy()}>
        Copy link
      </button>
      {status === 'manual' ? (
        <input
          ref={manualRef}
          className="copy-link__fallback"
          readOnly
          aria-label="Link to copy"
          value={window.location.href}
          onBlur={() => setStatus('idle')}
        />
      ) : null}
      <span className="copy-link__status" aria-live="polite">
        {status === 'copied' ? 'Link copied' : status === 'manual' ? 'Press Ctrl+C or Cmd+C to copy the link' : ''}
      </span>
    </span>
  );
}

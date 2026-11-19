import { useSyncExternalStore } from 'react';

/** The width below which the layout is the single-column phone layout. Keep in step with the CSS. */
export const PHONE_QUERY = '(max-width: 899.98px)';

function subscribe(query: string, onChange: () => void): () => void {
  const list = window.matchMedia(query);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

/** Live result of a media query. False where matchMedia is missing (tests, server). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => (typeof window.matchMedia === 'function' ? subscribe(query, onChange) : () => undefined),
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

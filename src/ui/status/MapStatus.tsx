import type { MapStatusMessage } from './statusText';

interface MapStatusProps {
  readonly message: MapStatusMessage | null;
  readonly onRetry: () => void;
}

/**
 * A quiet line over the map saying what is loading. The live region stays mounted while empty,
 * because screen readers often skip a live region that appears together with its text.
 */
export function MapStatus({ message, onRetry }: MapStatusProps) {
  return (
    <div className="map-status" role="status" aria-live="polite" data-kind={message?.kind ?? 'idle'}>
      {message ? (
        <p className="map-status__line">
          {message.kind === 'busy' ? <span className="map-status__mark" aria-hidden="true" /> : null}
          <span>{message.text}</span>
          {message.kind === 'error' ? (
            <button type="button" className="map-status__retry" onClick={onRetry}>
              Try again
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

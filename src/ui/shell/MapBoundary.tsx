import { Component, type ErrorInfo, type ReactNode } from 'react';

interface MapBoundaryProps {
  readonly children: ReactNode;
}

interface MapBoundaryState {
  readonly hasFailed: boolean;
}

/** Catches a failed map chunk download (or a map crash) so the site bar and panel keep working. */
export class MapBoundary extends Component<MapBoundaryProps, MapBoundaryState> {
  override state: MapBoundaryState = { hasFailed: false };

  static getDerivedStateFromError(): MapBoundaryState {
    return { hasFailed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Map failed to load', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.hasFailed) return this.props.children;
    return (
      <div className="map-loading" role="alert">
        <p>The map could not be loaded.</p>
        <button type="button" className="button button--quiet" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}

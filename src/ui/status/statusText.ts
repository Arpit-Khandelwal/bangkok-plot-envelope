/** What the map status line says. Pure, so every state is tested without a map. */

export interface MapLoadState {
  /** The basemap has finished its first load. */
  readonly mapLoaded: boolean;
  readonly buildings: {
    readonly total: number;
    readonly loaded: number;
    readonly failed: number;
    readonly settled: boolean;
  };
  /** The plot's centre is outside the area the surrounding buildings were baked for. */
  readonly plotOutsideStudyArea: boolean;
  readonly outsideNote: string;
}

export interface MapStatusMessage {
  readonly text: string;
  /** `busy` shows the activity mark; `error` offers "Try again"; `note` is a quiet standing remark. */
  readonly kind: 'busy' | 'error' | 'note';
}

export function mapStatusMessage(state: MapLoadState): MapStatusMessage | null {
  const { buildings } = state;
  if (!state.mapLoaded) return { text: 'Loading map', kind: 'busy' };
  if (!buildings.settled) {
    return { text: `Loading surrounding buildings (${buildings.loaded} of ${buildings.total})`, kind: 'busy' };
  }
  if (buildings.failed > 0) {
    const text =
      buildings.failed === buildings.total
        ? 'Surrounding buildings could not be loaded.'
        : `Some surrounding buildings could not be loaded (${buildings.failed} of ${buildings.total} areas missing).`;
    return { text, kind: 'error' };
  }
  if (state.plotOutsideStudyArea) return { text: state.outsideNote, kind: 'note' };
  return null;
}

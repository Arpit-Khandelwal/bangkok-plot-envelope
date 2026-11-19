/** The map area while the map chunk loads. Mirrors the static shell in index.html. */
export function MapFallback() {
  return (
    <div className="map-loading" role="status">
      Loading map
    </div>
  );
}

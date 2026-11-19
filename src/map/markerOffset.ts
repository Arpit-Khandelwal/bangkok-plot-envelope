/** Screen-space placement of the edge chips. Pure, so it is tested without a map. */

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** [x, y] in CSS pixels, as MapLibre's `Marker.setOffset` takes it. */
export type PixelOffset = readonly [x: number, y: number];

/** How far each chip's centre sits outside its edge's midpoint. */
export const EDGE_MARKER_OFFSET_PX = 18;

const NO_OFFSET: PixelOffset = [0, 0];

/** Twice the signed shoelace area. Its sign says on which side of each edge the interior lies. */
function doubledSignedArea(ring: readonly ScreenPoint[]): number {
  let sum = 0;
  ring.forEach((point, index) => {
    const next = ring[(index + 1) % ring.length] ?? point;
    sum += point.x * next.y - next.x * point.y;
  });
  return sum;
}

function vertexAverage(ring: readonly ScreenPoint[]): ScreenPoint {
  const total = ring.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / ring.length, y: total.y / ring.length };
}

function scaled(x: number, y: number, distance: number): PixelOffset {
  const length = Math.hypot(x, y);
  if (!(length > 0) || !Number.isFinite(length)) return NO_OFFSET;
  return [(x / length) * distance, (y / length) * distance];
}

/**
 * For each edge `i` (from `ring[i]` to `ring[i + 1]`, rings given as projected screen points),
 * the offset that moves its chip `distance` pixels outward along the edge's outward normal.
 *
 * Outward is decided by the ring's winding, not by the centroid, so it is right for concave
 * plots too. The sign test is purely algebraic: with a positive signed area the interior lies on
 * the (-dy, dx) side of every edge, whichever way the y axis points. An edge that collapses to a
 * point on screen (seen end-on) is pushed away from the ring's vertex average instead.
 */
export function outwardOffsets(ring: readonly ScreenPoint[], distance: number = EDGE_MARKER_OFFSET_PX): PixelOffset[] {
  if (ring.length < 3) return ring.map(() => NO_OFFSET);
  const area = doubledSignedArea(ring);
  const centre = vertexAverage(ring);
  return ring.map((start, index) => {
    const end = ring[(index + 1) % ring.length] ?? start;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.hypot(dx, dy) < 1e-6 || area === 0) {
      return scaled((start.x + end.x) / 2 - centre.x, (start.y + end.y) / 2 - centre.y, distance);
    }
    return area > 0 ? scaled(dy, -dx, distance) : scaled(-dy, dx, distance);
  });
}

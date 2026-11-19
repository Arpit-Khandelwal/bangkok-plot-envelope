/** The building as one closed solid per floor use, each floor its own prism so floor lines show. */
import { extrudeRegion, mergeMeshes } from '../geom';
import type { Floor, FloorUse, MassingPart } from '../types';

const USE_ORDER: readonly FloorUse[] = ['parking', 'residential', 'office', 'mixed'];

export function buildMassing(floors: readonly Floor[]): readonly MassingPart[] {
  return USE_ORDER.flatMap((use) => {
    const own = floors.filter((f) => f.use === use);
    if (own.length === 0) return [];
    return [{ use, mesh: mergeMeshes(own.map((f) => extrudeRegion(f.outline, f.baseM, f.topM))) }];
  });
}

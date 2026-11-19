/** Design totals, every one a sum over the floors. */
import { regionArea, unionAll } from '../geom';
import { addFloor, farArea, NO_AREA, parkingNeed, stallsProvided } from '../measure/areas';
import type { DesignTotals, Floor } from '../types';
import type { DesignContext } from './context';

export function computeTotals(ctx: DesignContext, floors: readonly Floor[], allowedFar: number): DesignTotals {
  const sums = floors.reduce((s, f) => addFloor(s, f.use, f.areaM2), NO_AREA);
  const plot = ctx.site.areaM2;
  const farFloorAreaM2 = farArea(sums, ctx.reading);
  const coverageM2 = regionArea(unionAll(floors.map((f) => f.outline)));
  const need = parkingNeed(sums.main, ctx.regime.parking, ctx.assumptions, ctx.buildingType);
  const top = floors[floors.length - 1];
  const roofDeckHeightM = top?.topM ?? 0;
  const volume = floors.reduce((v, f) => v + f.areaM2 * (f.topM - f.baseM), 0);
  const envelopeVolume = ctx.envelope.volumeM3;
  return {
    grossFloorAreaM2: sums.gross,
    farFloorAreaM2,
    far: farFloorAreaM2 / plot,
    parkingFloorAreaM2: sums.parking,
    mainUseFloorAreaM2: sums.main,
    sellableAreaM2: sums.main * ctx.assumptions.efficiency,
    coverageM2,
    openSpaceM2: plot - coverageM2,
    storeys: floors.length,
    roofDeckHeightM,
    topHeightM: floors.length === 0 ? 0 : roofDeckHeightM + ctx.assumptions.parapetM,
    units: need.units,
    parkingRequired: need.required,
    parkingProvided: stallsProvided(sums.parking, ctx.assumptions),
    allowedFar,
    envelopeVolumeShare: envelopeVolume > 0 ? Math.min(1, Math.max(0, volume / envelopeVolume)) : 0,
  };
}

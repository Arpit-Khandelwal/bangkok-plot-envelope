/** Resolvers for open space, parking, floor height and informational rules. */
import type { FloorHeightSpec, InfoSpec, OpenSpaceSpec, ParkingSpec } from '../data/spec';
import { m, m2, num, pct } from '../format';
import type { ResolveInput, Resolver } from './types';

function atFullArea(share: number, input: ResolveInput): string {
  const max = input.maxGfaM2;
  if (max === null || !Number.isFinite(max)) return '';
  return `: ${m2(share * max)} if the full ${m2(max)} is built`;
}

function openSpaceRequirement(spec: OpenSpaceSpec, input: ResolveInput): string {
  const share = pct(spec.share);
  switch (spec.basis) {
    case 'plotArea':
      return `Leave at least ${share} of the plot as open space: ${m2(spec.share * input.site.areaM2)} of this ${m2(input.site.areaM2)} plot.`;
    case 'totalFloorArea':
      return `Leave open space of at least ${share} of the total floor area${atFullArea(spec.share, input)}.`;
    case 'largestFloor':
      return `Leave open space of at least ${share} of the building's largest single floor.`;
  }
}

const OPEN_SPACE_BASIS: Readonly<Record<OpenSpaceSpec['basis'], string>> = {
  plotArea: 'Open space is ground with nothing built over it; uncovered parking, pools and structures up to 1.20 m high count.',
  totalFloorArea:
    'The plan adds that this may not fall below the building-control minimum, so the largest open-space figure applies.',
  largestFloor: 'Open space is ground with nothing built over it; the largest of the open-space figures applies.',
};

export const resolveOpenSpace: Resolver<OpenSpaceSpec> = (spec, input) => {
  const typeNote =
    input.buildingType === 'office' && spec.basis !== 'totalFloorArea'
      ? ' The lower non-residential share applies only while no floor is residential.'
      : '';
  return {
    requirement: openSpaceRequirement(spec, input),
    basis: `${OPEN_SPACE_BASIS[spec.basis]}${typeNote}`,
    effects: { openSpace: { ruleId: spec.meta.id, basis: spec.basis, share: spec.share } },
  };
};

function parkingExample(spec: ParkingSpec, input: ResolveInput): string {
  const max = input.maxGfaM2;
  if (max === null || !Number.isFinite(max)) return '';
  return ` At ${m2(max)} of floor area the area rate alone gives ${num(Math.ceil(max / spec.m2PerStall))} spaces.`;
}

export const resolveParking: Resolver<ParkingSpec> = (spec, input) => {
  const perUnit =
    spec.stallsPerLargeUnit > 0
      ? ` or ${spec.stallsPerLargeUnit} per unit of ${m2(spec.largeUnitM2)} or more, whichever gives more`
      : '';
  return {
    requirement: `Provide one car space per ${m2(spec.m2PerStall)} of floor area${perUnit}.${parkingExample(spec, input)}`,
    basis: spec.note,
    effects: {
      parking: {
        m2PerStall: spec.m2PerStall,
        stallsPerLargeUnit: spec.stallsPerLargeUnit,
        ruleId: spec.meta.id,
      },
    },
  };
};

export const resolveFloorHeight: Resolver<FloorHeightSpec> = (spec) => ({
  requirement: `Floor-to-floor height at least ${m(spec.minFloorToFloorM)} for ${spec.roomLabel}.`,
  effects: { minFloorToFloorM: spec.minFloorToFloorM },
});

export const resolveInfo: Resolver<InfoSpec> = (spec) => ({
  requirement: spec.requirement,
  ...(spec.basis === undefined ? {} : { basis: spec.basis }),
  effects: {},
});

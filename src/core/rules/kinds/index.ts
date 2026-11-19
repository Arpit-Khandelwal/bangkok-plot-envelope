import type { RuleSpec } from '../data/spec';
import { resolveAccess } from './access';
import { resolveFloorHeight, resolveInfo, resolveOpenSpace, resolveParking } from './building';
import { resolveUniformSetback, resolveWaterwaySetback } from './edge-setbacks';
import { resolveFar } from './far';
import { resolveHeightPlane } from './height-plane';
import { resolveRoadSetback } from './road-setback';
import { resolveRegimeThreshold } from './threshold';
import type { Resolution, ResolveInput } from './types';
import { resolveUseSize } from './use-size';

export type { Resolution, ResolveInput, RuleEffects, SetbackDemand } from './types';

/** Applies one rule of any kind. The switch is exhaustive, so a new kind fails to compile here. */
export function resolveSpec(spec: RuleSpec, input: ResolveInput): Resolution {
  switch (spec.kind) {
    case 'far':
      return resolveFar(spec, input);
    case 'useSize':
      return resolveUseSize(spec, input);
    case 'regimeThreshold':
      return resolveRegimeThreshold(spec, input);
    case 'access':
      return resolveAccess(spec, input);
    case 'roadSetback':
      return resolveRoadSetback(spec, input);
    case 'uniformSetback':
      return resolveUniformSetback(spec, input);
    case 'waterwaySetback':
      return resolveWaterwaySetback(spec, input);
    case 'heightPlane':
      return resolveHeightPlane(spec, input);
    case 'openSpace':
      return resolveOpenSpace(spec, input);
    case 'parking':
      return resolveParking(spec, input);
    case 'floorHeight':
      return resolveFloorHeight(spec, input);
    case 'info':
      return resolveInfo(spec, input);
  }
}

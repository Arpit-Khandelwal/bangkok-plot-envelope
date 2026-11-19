/** Every check for one design, measured on its finished floors. */
import type { Check } from '../types';
import { accessAndStationChecks } from './access';
import { areaChecks } from './area';
import { buildingChecks } from './building';
import { measure } from './context';
import { firePlantingChecks } from './fire-planting';
import { frontAccessChecks } from './front-access';
import type { CheckInput } from './context';
import { geometryChecks } from './geometry';

export type { CheckInput } from './context';

export function runChecks(input: CheckInput): readonly Check[] {
  const measured = measure(input.floors);
  return [
    ...areaChecks(input, measured),
    ...geometryChecks(input, measured),
    ...accessAndStationChecks(input, measured),
    ...frontAccessChecks(input, measured),
    ...buildingChecks(input, measured),
    ...firePlantingChecks(input, measured),
  ];
}

export function passesAll(checks: readonly Check[]): boolean {
  return !checks.some((c) => c.status === 'fail');
}

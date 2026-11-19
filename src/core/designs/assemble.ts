/** Turns generated floors into a finished Design: totals, checks, massing, section, summary. */
import { passesAll, runChecks } from '../checks';
import type { CheckInput } from '../checks';
import type { Design, RegimeId } from '../types';
import type { DesignContext } from './context';
import type { Generated } from './generate';
import { buildMassing } from './massing';
import { buildSection } from './section';
import { computeTotals } from './totals';

/** What the checks need beyond the regime and the floors. */
export type CheckBase = Omit<CheckInput, 'regime' | 'floors'>;

export interface DesignSpec {
  readonly id: string;
  readonly name: string;
  readonly regime: RegimeId;
  /** Writes the one-line summary from the finished totals. */
  readonly summarise: (design: Omit<Design, 'summary'>) => string;
}

export function assembleDesign(
  ctx: DesignContext,
  generated: Generated,
  spec: DesignSpec,
  base: CheckBase,
  allowedFar: number,
): Design {
  const floors = generated.stack.floors;
  const checks = runChecks({ ...base, regime: ctx.regime, floors });
  const draft: Omit<Design, 'summary'> = {
    id: spec.id,
    name: spec.name,
    regime: spec.regime,
    floors,
    totals: computeTotals(ctx, floors, allowedFar),
    checks,
    passes: passesAll(checks),
    massing: buildMassing(floors),
    section: buildSection(ctx.site, ctx.regime, floors),
  };
  return { ...draft, summary: spec.summarise(draft) };
}

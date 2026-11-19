import type { Design, Problem } from '../../core/types';
import { useAppStore } from '../../state/store';
import type { EvaluationView } from '../../state/useEvaluation';
import { AssumptionsForm } from '../assumptions/AssumptionsForm';
import { Sources } from '../footer/Sources';
import { EdgeList } from '../plot/EdgeList';
import { measurePlot } from '../plot/plotMeasure';
import { PlotSummary } from '../plot/PlotSummary';
import { Results } from '../results/Results';
import { WhatIfNotice } from '../results/WhatIfNotice';
import { ZoneNotice } from '../zone/ZoneNotice';
import { isOutsideCoverage } from '../zone/zoneCoverage';
import { EmptyState } from './EmptyState';
import { Problems } from './Problems';

const ZONE_PROBLEMS: readonly Problem['code'][] = ['outside-zone', 'unsupported-zone'];

export interface PanelProps {
  readonly view: EvaluationView;
  /** The selected design, already resolved against the evaluation. */
  readonly design: Design | null;
  /** Set when the map could not load its surrounding layers. */
  readonly mapError: string | null;
}

function Verdict({ view, design }: Pick<PanelProps, 'view' | 'design'>) {
  const { evaluation, zoneLookup, dataStatus } = view;
  if (dataStatus.state === 'loading') {
    return (
      <p className="notice" role="status">
        Checking which zone the plot is in.
      </p>
    );
  }
  const others = evaluation?.problems.filter((problem) => !ZONE_PROBLEMS.includes(problem.code)) ?? [];
  // Without the zone map the zone is unknown, which is not the same as outside ย.7.
  if (dataStatus.state === 'error') return <Problems problems={others} />;
  if (zoneLookup && isOutsideCoverage(zoneLookup)) {
    return (
      <>
        <ZoneNotice lookup={zoneLookup} />
        <Problems problems={others} />
      </>
    );
  }
  if (!evaluation) return null;
  if (!evaluation.ok) return <Problems problems={evaluation.problems} />;
  return <Results evaluation={evaluation} design={design} />;
}

/** The results panel: plot, edges, verdict, assumptions and sources, top to bottom. */
export function Panel({ view, design, mapError }: PanelProps) {
  const plot = useAppStore((state) => state.plot);
  const site = view.evaluation?.site ?? null;
  const measure = plot ? measurePlot(plot, site) : null;

  return (
    <aside className="panel" aria-label="Plot and results">
      {view.dataStatus.state === 'error' ? (
        <p className="notice notice--fail" role="alert">
          The zone map could not be loaded ({view.dataStatus.message}), so the zone cannot be checked and no verdict is given.
          Reload the page to try again.
        </p>
      ) : null}
      {mapError ? (
        <p className="notice notice--warn" role="alert">
          {mapError}
        </p>
      ) : null}
      {measure ? (
        <>
          <PlotSummary measure={measure} station={view.station} />
          <EdgeList edgeLengthsM={measure.edgeLengthsM} />
          <div className="verdict">
            <WhatIfNotice />
            <Verdict view={view} design={design} />
          </div>
          <AssumptionsForm />
        </>
      ) : (
        <EmptyState />
      )}
      <Sources />
    </aside>
  );
}

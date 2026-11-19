import { useEffect, useRef } from 'react';
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
import { Problems, withoutRoadPrompt } from './Problems';
import { roadEdgeCount } from '../plot/edgeChoices';

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
  const roadPromptVisible = useAppStore((state) => roadEdgeCount(state.edges) === 0);
  if (dataStatus.state === 'loading') {
    return (
      <p className="notice" role="status">
        Checking which zone the plot is in.
      </p>
    );
  }
  const others = evaluation?.problems.filter((problem) => !ZONE_PROBLEMS.includes(problem.code)) ?? [];
  // Without the zone map the zone is unknown, which is not the same as outside ย.7.
  if (dataStatus.state === 'error') return <Problems problems={withoutRoadPrompt(others, roadPromptVisible)} />;
  if (zoneLookup && isOutsideCoverage(zoneLookup)) {
    return (
      <>
        <ZoneNotice lookup={zoneLookup} />
        {/* Which edge faces the road is beside the point when there is no verdict. */}
        <Problems problems={withoutRoadPrompt(others, true)} />
      </>
    );
  }
  if (!evaluation) return null;
  if (!evaluation.ok) return <Problems problems={withoutRoadPrompt(evaluation.problems, roadPromptVisible)} />;
  return <Results evaluation={evaluation} design={design} />;
}

/** The results panel: plot, edges, verdict, assumptions and sources, top to bottom. */
export function Panel({ view, design, mapError }: PanelProps) {
  const plot = useAppStore((state) => state.plot);
  const plotRevision = useAppStore((state) => state.plotRevision);
  const panelRef = useRef<HTMLElement>(null);
  const lastRevision = useRef(plotRevision);

  // An example was loaded or the plot cleared: start again from the top. Ordinary edits keep the scroll.
  useEffect(() => {
    if (lastRevision.current === plotRevision) return;
    lastRevision.current = plotRevision;
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [plotRevision]);
  const hasNoVerdictZone = isOutsideCoverage(view.zoneLookup);
  const site = view.evaluation?.site ?? null;
  const measure = plot ? measurePlot(plot, site) : null;

  return (
    <aside ref={panelRef} className="panel" aria-label="Plot and results">
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
          <EdgeList edgeLengthsM={measure.edgeLengthsM} showRoadPrompt={!hasNoVerdictZone} />
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

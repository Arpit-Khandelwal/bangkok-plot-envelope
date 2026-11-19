import { siteEdgeLetter } from '../../core/edgeNames';
import type { Design } from '../../core/types';
import type { OkEvaluation } from '../model/buildModel';
import { Problems } from '../panel/Problems';
import { RuleList } from '../rules/RuleList';
import { SectionDrawing } from '../section/SectionDrawing';
import { AreaSchedule } from './AreaSchedule';
import { Checklist } from './Checklist';
import { DesignFigures } from './DesignFigures';
import { DesignSwitcher } from './DesignSwitcher';
import { ResultsAnnouncer } from './ResultsAnnouncer';
import { useIsWhatIf } from './whatIf';

export interface ResultsProps {
  readonly evaluation: OkEvaluation;
  readonly design: Design | null;
}

/** Everything shown for a successful evaluation, for the selected design. */
export function Results({ evaluation, design }: ResultsProps) {
  const qualified = useIsWhatIf(evaluation.nonDefaultReadings);
  const notes = evaluation.problems.filter((problem) => !problem.blocking);
  const blocking = evaluation.problems.filter((problem) => problem.blocking);
  if (blocking.length > 0) return <Problems problems={blocking} />;

  // The core's own "no design" note already says why; a second sentence would compete with it.
  const hasDesignNote = notes.some((problem) => problem.code === 'no-design');

  if (!design) {
    return (
      <>
        <Problems problems={notes} />
        {hasDesignNote ? null : (
          <p className="notice">No design fits on this plot under the current rules. Try a larger plot or a wider road.</p>
        )}
      </>
    );
  }

  const regime = evaluation.regimes[design.regime].rules;
  return (
    <>
      <Problems problems={notes} />
      {evaluation.designs.length === 1 && !hasDesignNote ? <p className="notice">Only one design fits this plot under the current rules.</p> : null}
      <ResultsAnnouncer design={design} qualified={qualified} />
      <DesignSwitcher designs={evaluation.designs} selectedId={design.id} qualified={qualified} />
      <div className="design-detail" key={design.id}>
        <DesignFigures design={design} regime={regime} plotAreaM2={evaluation.site.areaM2} />
        {design.section ? (
          <figure className="panel-section section-figure">
            <SectionDrawing profile={design.section} roadEdgeLetter={siteEdgeLetter(evaluation.site, design.section.roadEdgeIndex)} />
            <figcaption className="section-figure__caption">
              Section at right angles to the road, drawn to scale. The blue line is the height limit; the building must stay below it.
            </figcaption>
          </figure>
        ) : null}
        <Checklist checks={design.checks} qualified={qualified} />
        <AreaSchedule design={design} />
        <RuleList regime={design.regime} rules={regime.rules} />
      </div>
    </>
  );
}

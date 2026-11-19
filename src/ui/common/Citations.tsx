import type { Citation, Confidence } from '../../core/types';

const CONFIDENCE_NOTES: Readonly<Record<Confidence, string | null>> = {
  verified: null,
  corroborated: 'corroborated, not read in the official text',
  assumption: 'our reading',
};

export interface CitationsProps {
  readonly citations: readonly Citation[];
}

/** Document and clause for each source. The clause is set in Sarabun, as in the Gazette. */
export function Citations({ citations }: CitationsProps) {
  if (citations.length === 0) return null;
  return (
    <ul className="citations" aria-label="Sources">
      {citations.map((citation, index) => {
        const note = CONFIDENCE_NOTES[citation.confidence];
        return (
          <li key={`${citation.document}-${citation.clause}-${index}`} className="citations__item">
            <a href={citation.url} target="_blank" rel="noreferrer" className="citations__link">
              {citation.document},{' '}
              <span lang="th" className="thai">
                {citation.clause}
              </span>
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
            {note ? <span className="citations__note"> ({note})</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

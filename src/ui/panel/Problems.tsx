import type { Problem } from '../../core/types';

export interface ProblemsProps {
  readonly problems: readonly Problem[];
}

/** Problems as plain messages. Blocking ones read as errors; the rest as notes beside a result. */
export function Problems({ problems }: ProblemsProps) {
  if (problems.length === 0) return null;
  return (
    <ul className="problems">
      {problems.map((problem, index) => (
        <li
          key={`${problem.code}-${index}`}
          className={`notice ${problem.blocking ? 'notice--fail' : 'notice--warn'}`}
          role={problem.blocking ? 'alert' : undefined}
        >
          {problem.message}
        </li>
      ))}
    </ul>
  );
}

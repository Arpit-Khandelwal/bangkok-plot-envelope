import type { Design } from "../../core/types";
import { useAppStore } from "../../state/store";
import { StatusMark } from "../common/StatusMark";
import { formatM2, formatMetres, plural } from "../format";

export interface DesignSwitcherProps {
  readonly designs: readonly Design[];
  readonly selectedId: string;
}

function failedCount(design: Design): number {
  return design.checks.filter((check) => check.status === "fail").length;
}

function cellClass(design: Design, selectedId: string): string {
  return design.id === selectedId
    ? "compare__cell compare__cell--selected"
    : "compare__cell";
}

/** The designs side by side, one column each. The column header selects the design. */
export function DesignSwitcher({ designs, selectedId }: DesignSwitcherProps) {
  const selectDesign = useAppStore((state) => state.selectDesign);
  const selected = designs.find((design) => design.id === selectedId);
  const showBoth = designs.some(
    (design) =>
      Math.abs(design.totals.grossFloorAreaM2 - design.totals.farFloorAreaM2) >
      0.5,
  );

  return (
    <section className="panel-section" aria-labelledby="designs-heading">
      <h2 id="designs-heading" className="panel-section__title">
        Concept designs
      </h2>
      <div className="scroll-x">
        <table className="compare">
          <caption className="visually-hidden">
            Concept designs compared. Choose a design to show it on the map.
          </caption>
          <thead>
            <tr>
              <td className="compare__corner" />
              {designs.map((design) => (
                <th
                  key={design.id}
                  scope="col"
                  className={cellClass(design, selectedId)}
                >
                  <button
                    type="button"
                    className="compare__choose"
                    aria-pressed={design.id === selectedId}
                    onClick={() => selectDesign(design.id)}
                  >
                    <span className="compare__name">{design.name}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                {showBoth
                  ? "Floor area counted toward the floor area ratio (FAR)"
                  : "Floor area"}
              </th>
              {designs.map((design) => (
                <td
                  key={design.id}
                  className={`${cellClass(design, selectedId)} num`}
                >
                  {formatM2(design.totals.farFloorAreaM2)}
                </td>
              ))}
            </tr>
            {showBoth ? (
              <tr>
                <th scope="row">Total floor area built</th>
                {designs.map((design) => (
                  <td
                    key={design.id}
                    className={`${cellClass(design, selectedId)} num`}
                  >
                    {formatM2(design.totals.grossFloorAreaM2)}
                  </td>
                ))}
              </tr>
            ) : null}
            <tr>
              <th scope="row">Storeys</th>
              {designs.map((design) => (
                <td
                  key={design.id}
                  className={`${cellClass(design, selectedId)} num`}
                >
                  {design.totals.storeys}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Height</th>
              {designs.map((design) => (
                <td
                  key={design.id}
                  className={`${cellClass(design, selectedId)} num`}
                >
                  {formatMetres(design.totals.topHeightM)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Result</th>
              {designs.map((design) => (
                <td key={design.id} className={cellClass(design, selectedId)}>
                  <StatusMark status={design.passes ? "pass" : "fail"} />
                  {design.passes ? null : (
                    <span className="compare__fails">
                      {plural(failedCount(design), "check")} failed
                    </span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="scroll-hint">Scroll sideways to see every design.</p>
      {selected ? <p className="compare__summary">{selected.summary}</p> : null}
    </section>
  );
}

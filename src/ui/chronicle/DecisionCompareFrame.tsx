import { frameArtSpaceStyle, frameBoxStyle, frameToken } from "../frameBox";
import { wave19FrameLayerStyle, wave19ImageStyle } from "../wave19Art";
import { ChronicleArtView } from "./ChronicleArtView";
import type { DecisionCompareView } from "./chronicleScreenModel";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";

// CHRON-1 decision record (CHRONICLE_DESIGN 2.4): the Wave 19 `frame_decision_compare` (512 x 240 art, three columns —
// the way chosen, the other ways, each predicted number against what came with `icon_predicted` / `icon_actual` and
// `icon_delta_up` / `icon_delta_down`), drawn at `scale`. UI-AUDIT-1: the frame's border is its safe inset at `scale`
// (frame kind `decision`); the columns sit in the art's coordinates over it.
export const DECISION_FRAME = frameToken("decision").size;
/** The three columns' content boxes on the art (below the header plates at the top of each). */
const COLUMNS = [{ left: 16, right: 344 }, { left: 184, right: 176 }, { left: 350, right: 14 }] as const;

export function DecisionCompareFrame({ view, scale }: { readonly view: DecisionCompareView; readonly scale: number }) {
  const column = (index: 0 | 1 | 2) => ({ left: COLUMNS[index].left * scale, right: COLUMNS[index].right * scale, top: 12 * scale, bottom: 14 * scale });
  return (
    <section className="chronicle-decision" data-frame="decision" aria-label={view.heading} data-decision={view.id}
      style={{ width: DECISION_FRAME.width * scale, height: DECISION_FRAME.height * scale, ...frameBoxStyle("decision", scale) }}>
      <span className="chronicle-decision-frame" aria-hidden="true" style={wave19FrameLayerStyle("frame_decision_compare", scale)} />
      <div className="chronicle-decision-art" style={frameArtSpaceStyle("decision", scale)}>
      <div className="chronicle-decision-column" style={column(0)}>
        <h4>{COPY.chosenHeading}</h4>
        <ChronicleArtView art={view.art} size={Math.round(64 * scale)} className="chronicle-decision-art" />
        <strong className="chronicle-decision-chosen">{view.chosen}</strong>
      </div>
      <div className="chronicle-decision-column" style={column(1)}>
        <h4>{COPY.alternativesHeading}</h4>
        {view.alternatives.length === 0 ? <p>{COPY.noAlternatives}</p> : <ul>{view.alternatives.map(option => <li key={option}>{option}</li>)}</ul>}
      </div>
      <div className="chronicle-decision-column" style={column(2)}>
        <h4>{COPY.compareHeading}</h4>
        <dl className="chronicle-decision-rows">
          {view.rows.map(row => (
            <div key={row.key} className="chronicle-decision-row" data-delta={row.delta ?? "pending"}>
              <dt><span aria-hidden="true" style={wave19ImageStyle("icon_predicted", 18)} />{row.predicted}</dt>
              <dd>
                {row.actual === null ? null : <><span aria-hidden="true" style={wave19ImageStyle("icon_actual", 18)} />{row.actual}</>}
                {row.delta === "up" || row.delta === "down" ? <span aria-hidden="true" style={wave19ImageStyle(row.delta === "up" ? "icon_delta_up" : "icon_delta_down", 18)} /> : null}
                {row.deltaLabel === null ? null : <span className="chronicle-decision-delta">{row.deltaLabel}</span>}
              </dd>
            </div>
          ))}
        </dl>
        {view.pending === null ? null : <p className="chronicle-decision-pending">{view.pending}</p>}
      </div>
      </div>
    </section>
  );
}

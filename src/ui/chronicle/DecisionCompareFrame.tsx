import { frameArtSpaceStyle, frameBoxStyle, frameToken } from "../frameBox";
import { wave19FrameLayerStyle, wave19ImageStyle } from "../wave19Art";
import { ChronicleArtView } from "./ChronicleArtView";
import { slotInside } from "./paintedSlots";
import type { DecisionCompareView } from "./chronicleScreenModel";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";

// CHRON-1 decision record (CHRONICLE_DESIGN 2.4): the Wave 19 `frame_decision_compare` (512 x 240 art, three columns —
// the way chosen, the other ways, each predicted number against what came with `icon_predicted` / `icon_actual` and
// `icon_delta_up` / `icon_delta_down`), drawn at `scale`. UI-AUDIT-1: the frame's border is its safe inset at `scale`
// (frame kind `decision`); the columns sit in the art's coordinates over it.
export const DECISION_FRAME = frameToken("decision").size;
/** The three columns on the art, each from its header plate down (UI-AUDIT-1: cut to the frame's content box). */
const COLUMNS = [{ left: 16, width: 152 }, { left: 184, width: 152 }, { left: 350, width: 148 }] as const;
const COLUMN_TOP = 12; const COLUMN_BOTTOM = 226;
/** The header plates' middle on the art (they run y 14–47): a column's title stays centred on its plate. */
const PLATE_MIDDLE = 30.5;

export function DecisionCompareFrame({ view, scale }: { readonly view: DecisionCompareView; readonly scale: number }) {
  const column = (index: 0 | 1 | 2) => slotInside("decision", DECISION_FRAME, scale, { ...COLUMNS[index], top: COLUMN_TOP, height: COLUMN_BOTTOM - COLUMN_TOP });
  const heading = { height: 2 * (PLATE_MIDDLE * scale - Number(column(0).top)) };
  return (
    <section className="chronicle-decision" data-frame="decision" aria-label={view.heading} data-decision={view.id}
      style={{ width: DECISION_FRAME.width * scale, height: DECISION_FRAME.height * scale, ...frameBoxStyle("decision", scale) }}>
      <span className="chronicle-decision-frame" aria-hidden="true" style={wave19FrameLayerStyle("frame_decision_compare", scale)} />
      <div className="chronicle-decision-art" style={frameArtSpaceStyle("decision", scale)}>
      <div className="chronicle-decision-column" style={column(0)}>
        <h4 style={heading}>{COPY.chosenHeading}</h4>
        <ChronicleArtView art={view.art} size={Math.round(64 * scale)} className="chronicle-decision-art" />
        <strong className="chronicle-decision-chosen">{view.chosen}</strong>
      </div>
      <div className="chronicle-decision-column" style={column(1)}>
        <h4 style={heading}>{COPY.alternativesHeading}</h4>
        {view.alternatives.length === 0 ? <p>{COPY.noAlternatives}</p> : <ul>{view.alternatives.map(option => <li key={option}>{option}</li>)}</ul>}
      </div>
      <div className="chronicle-decision-column" style={column(2)}>
        <h4 style={heading}>{COPY.compareHeading}</h4>
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

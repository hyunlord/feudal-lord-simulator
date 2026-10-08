import { useEffect, useState, type ReactElement } from "react";
import { lordMode } from "../../../engine/townAgency";
import { Button, Toggle } from "../../kit";
import { PRECEDENT_ART, wave44ImageStyle } from "../../wave44Art";
import type { LordNavGate, LordPanelProps } from "../screen/lordScreenTypes";
import { STEWARD_COPY as COPY } from "./stewardCopy.ko";
import { standingPolicyScreen, type PolicyKindRow } from "./standingPolicyModel";

// DEC-CARD-2 (the user's order 2026-10-08): the lord screen's 상시 방침 — the kinds of small matter grouped by family
// (장원 청원, 지도 밖 영지, 세력이 보내는 일), each a row with its setting and this year's count; pressing one opens it:
// the four settings as equal buttons (all secondary, the one in force pressed), what each would do under it, and the
// last one the steward handled. Opened on a kind (the season card's drill-in) that kind is open. The Wave 44 picture
// of the steward at his work (13, once the precedent card's) heads the screen. Every press is the game's own command.

/** Open in lord mode (the host gates it too). */
export const policyGate: LordNavGate = state => lordMode(state) ? null : COPY.closed;

const ART_WIDTH = 320;

function KindDetail({ row, command }: { readonly row: PolicyKindRow; readonly command: LordPanelProps["dispatch"] }) {
  return (
    <div className="lord-standing-detail" data-standing-detail={row.kind}>
      <ul className="lord-standing-options">
        {row.options.map(option => (
          <li key={option.setting} className="lord-standing-choice" data-setting={option.setting} data-current={option.current ? "true" : undefined}>
            <Button type="button" className="lord-standing-set" variant="secondary" size="md" aria-pressed={option.current}
              aria-label={COPY.choose(row.title, option.label)} onPress={() => { if (!option.current) command(option.command); }}>{option.label}</Button>
            <ul className="lord-standing-does">{option.does.map(line => <li key={line}>{line}</li>)}</ul>
          </li>))}
      </ul>
      <p className="lord-standing-line">{row.handled}{row.last === null ? null : ` · ${row.last}`}</p>
    </div>
  );
}

export function StandingPolicyPanel({ state, dispatch, focus }: LordPanelProps): ReactElement | null {
  const view = standingPolicyScreen(state);
  // A press names the command, the game dispatches it (B9 input boundary R4), as the other lord screens do.
  const command = (action: Parameters<LordPanelProps["dispatch"]>[0]) => dispatch(action);
  const [open, setOpen] = useState<string | null>(focus);
  useEffect(() => { if (focus !== null) setOpen(focus); }, [focus]);
  if (view === null) return null;
  return (
    <div className="lord-standing" data-lord-standing={String(view.families.reduce((sum, family) => sum + family.kinds.length, 0))}>
      <div className="lord-standing-art" aria-hidden="true" style={wave44ImageStyle(PRECEDENT_ART, ART_WIDTH)} />
      <h3>{COPY.screenTitle}</h3>
      <p className="lord-standing-line">{COPY.screenIntro}</p>
      {view.families.map(family => (
        <section key={family.family} className="lord-standing-family" data-family={family.family} aria-label={family.heading}>
          <h4>{family.heading}</h4>
          <p className="lord-standing-line">{family.line}</p>
          {family.family === "manor" ? <div className="lord-standing-all">
            <Toggle className="lord-standing-all-toggle" data-rule="recurring" checked={view.allToLord} label={COPY.allToLord} onChange={() => command(view.allToLordCommand)} />
            {view.allToLord ? <p className="lord-standing-line">{COPY.allToLordOn}</p> : null}
          </div> : null}
          <ul className="lord-standing-kinds">
            {family.kinds.map(row => (
              <li key={row.kind} className="lord-standing-kind" data-kind={row.kind}>
                <Button type="button" className="lord-standing-open" variant="secondary" aria-expanded={open === row.kind}
                  onPress={() => setOpen(open === row.kind ? null : row.kind)}>
                  <span className="lord-standing-title">{row.title}</span><span className="lord-standing-current">{row.row}</span>
                </Button>
                {open === row.kind ? <KindDetail row={row} command={command} /> : null}
              </li>))}
          </ul>
        </section>))}
    </div>
  );
}

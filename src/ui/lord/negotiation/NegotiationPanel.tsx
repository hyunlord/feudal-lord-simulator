import { useMemo, useState, type ReactElement } from "react";
import type { GameState } from "../../../engine/engine.types";
import { DECISION_CARD_COPY as CARD } from "../../decisionCard/decisionCardCopy.ko";
import { Button } from "../../kit";
import { lordPortraitStyle } from "../screen/lordPortrait";
import type { LordNavGate, LordPanelProps } from "../screen/lordScreenTypes";
import { useUiParts, type UI_PART_ART } from "../uiPartArt";
import { DIVIDER_WIDTH, NEGOTIATION_ART, NEGOTIATION_ART_IDS, scaleStyle, SEAL_WIDTH } from "./negotiationArt";
import { NEGOTIATION_COPY as COPY } from "./negotiationCopy.ko";
import {
  chooseGroom, EMPTY_DRAFT, negotiationGateReason, negotiationScreen, stepAmount, stepPensionYears, toggleClause,
  type AcceptanceView, type AmountKind, type ClauseEditor, type CounterView, type Draft, type DraftView, type LastAnswer, type PartyView,
  type TimelineView, type ToggleKind, type TreatyRow,
} from "./negotiationModel";

// LM-R2 (negotiation area): the lord screen's 혼인 item (src/ui/lord/screen/LordScreen.tsx). The draft — groom, clauses and the
// counterpart's live answer — then the counter, then the marriage's progress (negotiationModel.ts). One primary button (the
// offer); a counter's two answers are equal choices (both secondary, LR1-D2). Pickers are kit Buttons only (no native input).

export const negotiationGate: LordNavGate = (state: GameState) => negotiationGateReason(state);

type Parts = typeof UI_PART_ART;
type Mark = "same" | "changed" | "rejected";

function Portrait({ party, size }: { readonly party: PartyView; readonly size: number }): ReactElement {
  const face = lordPortraitStyle(party.row, size);
  return <span className="lord-neg-face" aria-hidden="true" style={face ?? { width: size, height: size }} data-face={face === null ? "none" : "drawn"} />;
}

function Seal({ parts, seal }: { readonly parts: Parts; readonly seal: "empty" | "stamped" | "broken" }): ReactElement {
  const art = parts.image(NEGOTIATION_ART.seals[seal], SEAL_WIDTH);
  return <span className="lord-neg-seal" aria-hidden="true" data-seal={seal} data-art={art === null ? "none" : "drawn"} style={art ?? undefined} />;
}

/** A clause in its row frame; what the counter did to it is written under the frame (the rejected row's art strikes
 * through its middle, so nothing but the struck clause sits inside it). */
function Row({ parts, row, mark = "same", extra }: { readonly parts: Parts; readonly row: TreatyRow; readonly mark?: Mark; readonly extra?: ReactElement | null }): ReactElement {
  const art = parts.frame(NEGOTIATION_ART.rows[mark]);
  return (
    <li className="lord-neg-row-item">
      <div className="lord-neg-row" data-clause={row.kind} data-mark={mark} data-frame={art?.dataFrame ?? "record"} style={art?.style}>
        <span className="lord-neg-row-name">{row.name}</span>
        {row.value === null ? null : <span className="lord-neg-row-value">{row.value}</span>}
      </div>
      {extra ?? null}
    </li>
  );
}

/** The treaty: its title and seal, the two sides with the 16 px centre line between, then what follows (preview, answers). */
function Treaty({ parts, heading, seal, ours, theirs, children }: {
  readonly parts: Parts; readonly heading: string; readonly seal: "empty" | "stamped" | "broken";
  readonly ours: readonly ReactElement[]; readonly theirs: readonly ReactElement[]; readonly children?: ReactElement | readonly ReactElement[] | null;
}): ReactElement {
  const frame = parts.frame(NEGOTIATION_ART.treaty);
  const divider = parts.image(NEGOTIATION_ART.divider, DIVIDER_WIDTH);
  return (
    <section className="lord-neg-treaty" data-frame={frame?.dataFrame ?? "light"} data-art={frame === null ? "none" : "drawn"} style={frame?.style} aria-label={heading}>
      <header className="lord-neg-treaty-head"><h4>{heading}</h4><Seal parts={parts} seal={seal} /></header>
      <div className="lord-neg-sides">
        <div className="lord-neg-side" data-side="ours"><h5>{COPY.ourSide}</h5>
          {ours.length === 0 ? <p className="lord-neg-empty">{COPY.emptySide}</p> : <ul className="lord-neg-rows">{ours}</ul>}</div>
        <span className="lord-neg-divider" aria-hidden="true" data-art={divider === null ? "none" : "drawn"} style={divider ?? { width: DIVIDER_WIDTH }} />
        <div className="lord-neg-side" data-side="theirs"><h5>{COPY.theirSide}</h5>
          {theirs.length === 0 ? <p className="lord-neg-empty">{COPY.emptySide}</p> : <ul className="lord-neg-rows">{theirs}</ul>}</div>
      </div>
      {children ?? null}
    </section>
  );
}

/** The counterpart's view of the terms: the scale (a picture of the tier), the tier's word, the score and the top reasons. */
function Acceptance({ parts, view }: { readonly parts: Parts; readonly view: AcceptanceView }): ReactElement {
  const scale = scaleStyle(parts, view.tier);
  return (
    <div className="lord-neg-acceptance" data-tier={view.tier}>
      <div className="lord-neg-tier">
        <span className="lord-neg-scale" aria-hidden="true" data-art={scale === null ? "none" : "drawn"} style={scale ?? undefined} />
        <div><p className="lord-neg-tier-word">{COPY.tierLine(view.tierWord)}</p><p className="lord-neg-score">{COPY.scoreLine(view.score, view.line)}</p></div>
      </div>
      <h5>{COPY.reasonsHeading}</h5>
      <ul className="lord-neg-reasons">
        {view.reasons.map(reason => {
          const art = parts.frame(NEGOTIATION_ART.chips[reason.sign]);
          return <li key={reason.name} className="lord-neg-reason" data-reason={reason.name} data-sign={reason.sign} data-frame={art?.dataFrame ?? "record"} style={art?.style}>{reason.text}</li>;
        })}
      </ul>
    </div>
  );
}

function Answer({ last }: { readonly last: LastAnswer | null }): ReactElement | null {
  return last === null ? null : <p className="lord-neg-answer" data-answer={last.status} role="status">{last.text} <span>{last.tier}</span></p>;
}

function Editor({ editor, setDraft }: { readonly editor: ClauseEditor; readonly setDraft: (edit: (draft: Draft) => Draft) => void }): ReactElement {
  const kind = editor.kind;
  return (
    <li className="lord-neg-clause" data-clause={kind} data-on={editor.on === null ? undefined : String(editor.on)}>
      <div className="lord-neg-clause-head">
        <span className="lord-neg-clause-name">{editor.name}</span>
        {editor.value === null ? null : <span className="lord-neg-clause-value" data-amount={editor.value}>{editor.value}</span>}
      </div>
      {editor.steps === null ? null : (
        <div className="lord-neg-steps">
          {editor.steps.map(step => <Button key={step.delta} type="button" size="sm" className="lord-neg-step" data-step={step.delta} aria-label={step.label}
            disabled={!step.enabled} onPress={() => setDraft(draft => stepAmount(draft, kind as AmountKind, step.delta))}>{step.text}</Button>)}
          {editor.years === null ? null : <>
            <Button type="button" size="sm" className="lord-neg-step" data-step="years-less" aria-label={COPY.yearsLessLabel(editor.name)} disabled={!editor.years.less}
              onPress={() => setDraft(draft => stepPensionYears(draft, -1))}>{COPY.yearsLess}</Button>
            <Button type="button" size="sm" className="lord-neg-step" data-step="years-more" aria-label={COPY.yearsMoreLabel(editor.name)} disabled={!editor.years.more}
              onPress={() => setDraft(draft => stepPensionYears(draft, 1))}>{COPY.yearsMore}</Button>
          </>}
        </div>
      )}
      {editor.on === null ? null : (
        <Button type="button" variant="toggle" size="sm" className="lord-neg-switch" data-switch={kind} aria-pressed={editor.on} aria-label={COPY.includeLabel(editor.name)}
          disabled={!editor.switchable} onPress={() => setDraft(draft => toggleClause(draft, kind as ToggleKind))}>{COPY.include}</Button>
      )}
      {editor.note === null ? null : <p className="lord-neg-note">{editor.note}</p>}
    </li>
  );
}

function DraftScreen({ view, parts, dispatch, setDraft }: {
  readonly view: DraftView; readonly parts: Parts; readonly dispatch: LordPanelProps["dispatch"]; readonly setDraft: (edit: (draft: Draft) => Draft) => void;
}): ReactElement {
  const rows = (side: "ours" | "theirs") => view.rows.filter(row => row.side === side).map(row => <Row key={row.kind} parts={parts} row={row} />);
  const send = () => dispatch({ type: "propose_marriage", terms: view.terms, ...(view.groomId === null ? {} : { groomId: view.groomId }) });
  return (
    <>
      <Answer last={view.last} />
      <div className="lord-neg-parties">
        <section className="lord-neg-party" aria-label={COPY.groomHeading}><h4>{COPY.groomHeading}</h4>
          {view.grooms.length === 0 ? <p className="lord-neg-note">{COPY.noGroom}</p> : (
            <div className="lord-neg-grooms">
              {view.grooms.map(groom => <Button key={groom.id} type="button" variant="toggle" className="lord-neg-groom" data-groom={groom.id} aria-pressed={groom.chosen}
                aria-label={groom.choose} onPress={() => setDraft(draft => chooseGroom(draft, groom.id))}>
                <Portrait party={groom} size={40} /><span className="lord-neg-party-text"><span className="lord-neg-party-name">{groom.name}</span>
                  <span className="lord-neg-party-line">{groom.line}</span></span></Button>)}
            </div>
          )}
        </section>
        <section className="lord-neg-party" aria-label={COPY.brideHeading}><h4>{COPY.brideHeading}</h4>
          {view.bride === null ? <p className="lord-neg-note">{COPY.noBride}</p> : (
            <div className="lord-neg-bride"><Portrait party={view.bride} size={40} /><span className="lord-neg-party-text">
              <span className="lord-neg-party-name">{view.bride.name}</span><span className="lord-neg-party-line">{view.bride.line}</span></span></div>
          )}
        </section>
      </div>
      <section className="lord-neg-editor" aria-label={COPY.editorHeading}><h4>{COPY.editorHeading}</h4><p className="lord-neg-note">{COPY.editorIntro}</p>
        {(["ours", "theirs"] as const).map(side => (
          <div key={side} className="lord-neg-editor-side" data-side={side}><h5>{side === "ours" ? COPY.ourSide : COPY.theirSide}</h5>
            <ul className="lord-neg-clauses">{view.editors.filter(editor => editor.side === side).map(editor => <Editor key={editor.kind} editor={editor} setDraft={setDraft} />)}</ul>
          </div>
        ))}
      </section>
      <Treaty parts={parts} heading={COPY.draftTitle} seal={view.seal} ours={rows("ours")} theirs={rows("theirs")}>
        <Acceptance parts={parts} view={view.preview} />
        <p className="lord-neg-ceiling" data-ceiling={view.ceiling} data-below={String(view.ceilingBelow)}>{COPY.ceilingLine(view.ceiling)}{view.ceilingBelow ? ` ${COPY.ceilingBelow}` : ""}</p>
        <div className="lord-neg-actions">
          {view.refusalText === null ? null : <p className="lord-neg-refusal" data-refusal={view.refusal ?? ""}>{view.refusalText}</p>}
          <Button type="button" variant="primary" className="lord-neg-send" aria-label={COPY.sendLabel} disabled={view.refusal !== null} onPress={send}>{COPY.send}</Button>
        </div>
      </Treaty>
    </>
  );
}

/** DEC-CARD: one part of an answer (now / later / who remembers), in the heavy cards' words and classes. */
function Part({ heading, lines }: { readonly heading: string; readonly lines: readonly string[] }): ReactElement | null {
  // An empty part is left out (DEC-CARD: an empty "who remembers" on every answer buried the rest).
  return lines.length === 0 ? null : (
    <div className="decision-card-part">
      <span className="decision-card-part-head">{heading}</span>
      <ul>{lines.map(line => <li key={line}>{line}</li>)}</ul>
    </div>
  );
}

/** DEC-CARD: what each answer to the counter does (the engine's run of `answer_counter`), and what silence means. */
function Outlook({ view }: { readonly view: CounterView }): ReactElement {
  return (
    <section className="lord-neg-outlook" aria-label={COPY.outlookHeading}>
      <p className="lord-neg-note">{view.silence}</p>
      <ol className="lord-neg-outlook-answers">
        {view.outlook.map(answer => (
          <li key={answer.id} className="lord-neg-outlook-answer" data-answer-outlook={answer.id}>
            <h5>{answer.label}</h5>
            <Part heading={CARD.now} lines={answer.now} />
            <Part heading={CARD.later} lines={answer.later} />
            <Part heading={CARD.remembers} lines={answer.remembers} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function CounterScreen({ view, parts, dispatch }: { readonly view: CounterView; readonly parts: Parts; readonly dispatch: LordPanelProps["dispatch"] }): ReactElement {
  // A press names the answer, the game dispatches it (B9 R4).
  const answer = (accept: boolean) => dispatch({ type: "answer_counter", negotiationId: view.negotiationId, accept });
  const rows = (side: "ours" | "theirs") => view.rows.filter(row => row.side === side).map(row => <Row key={row.kind} parts={parts} row={row} mark={row.mark}
    extra={row.change === null ? null : <span className="lord-neg-row-change"><span className="lord-neg-row-mark">{row.markWord}</span> {row.change}</span>} />);
  const shut = !view.canAccept || !view.canRefuse;
  return (
    <>
      <Answer last={view.last} />
      <Treaty parts={parts} heading={COPY.counterTitle} seal={view.seal} ours={rows("ours")} theirs={rows("theirs")}>
        <p className="lord-neg-note">{COPY.counterIntro}</p>
        <Acceptance parts={parts} view={view.preview} />
        <p className="lord-neg-note">{view.offered}</p>
        <p className="lord-neg-deadline">{view.deadline}</p>
        <Outlook view={view} />
        <div className="lord-neg-actions lord-neg-answers">
          <Button type="button" className="lord-neg-accept" data-answer-counter="accept" aria-label={COPY.acceptLabel} disabled={!view.canAccept}
            onPress={() => answer(true)}>{COPY.accept}</Button>
          <Button type="button" className="lord-neg-refuse" data-answer-counter="refuse" aria-label={COPY.refuseLabel} disabled={!view.canRefuse}
            onPress={() => answer(false)}>{COPY.refuse}</Button>
          {shut ? <p className="lord-neg-refusal">{COPY.cannotNow}</p> : null}
        </div>
      </Treaty>
    </>
  );
}

function ContractScreen({ view, parts, onOpen }: { readonly view: TimelineView; readonly parts: Parts; readonly onOpen: LordPanelProps["onOpen"] }): ReactElement {
  const rows = (side: "ours" | "theirs") => view.rows.filter(row => row.side === side).map(row => <Row key={row.kind} parts={parts} row={row} />);
  return (
    <>
      <Answer last={view.last} />
      <section className="lord-neg-timeline" data-stage={view.stage} aria-label={COPY.timelineHeading}>
        <h4>{COPY.timelineHeading}</h4>
        <p className="lord-neg-stage">{COPY.stageNow(view.stageWord)}</p>
        <p className="lord-neg-note">{view.couple} · {view.contracted}</p>
        <ol className="lord-neg-events">
          {view.events.map(event => <li key={event.key} data-event={event.key}><span className="lord-neg-event-date">{event.date}</span><span>{event.text}</span></li>)}
        </ol>
        {view.details.length === 0 ? null : <ul className="lord-neg-details">{view.details.map(line => <li key={line}>{line}</li>)}</ul>}
        {view.outcome === null ? null : <p className="lord-neg-outcome" data-outcome={view.stage}>{view.outcome}</p>}
        {view.dueText === null ? null : <p className="lord-neg-due" data-due={view.due ?? ""} role="status">{view.dueText}</p>}
        {view.suitFocus === null ? null : (
          <div className="lord-neg-actions">
            <Button type="button" className="lord-neg-open-suit" data-open-suit={view.suitFocus} aria-label={COPY.openSuitLabel}
              onPress={() => onOpen("ledger", view.suitFocus ?? undefined)}>{COPY.openSuit}</Button>
          </div>
        )}
      </section>
      <Treaty parts={parts} heading={COPY.contractTitle} seal={view.seal} ours={rows("ours")} theirs={rows("theirs")} />
    </>
  );
}

export function NegotiationPanel({ state, dispatch, onOpen }: LordPanelProps): ReactElement {
  const [draft, setDraftState] = useState<Draft>(EMPTY_DRAFT);
  const parts = useUiParts(NEGOTIATION_ART_IDS);
  const view = useMemo(() => negotiationScreen(state, draft), [state, draft]);
  const setDraft = (edit: (draft: Draft) => Draft) => setDraftState(edit);
  return (
    <div className="lord-neg" data-neg-phase={view.phase}>
      <header className="lord-neg-head"><h3>{COPY.heading}</h3><p className="lord-neg-houses">{view.houses}</p></header>
      {view.phase === "draft" ? <DraftScreen view={view} parts={parts} dispatch={dispatch} setDraft={setDraft} />
        : view.phase === "countered" ? <CounterScreen view={view} parts={parts} dispatch={dispatch} />
        : <ContractScreen view={view} parts={parts} onOpen={onOpen} />}
    </div>
  );
}

import { useEffect, useMemo, useRef, type CSSProperties, type ReactElement } from "react";
import { lordMode } from "../../../engine/townAgency";
import { Button } from "../../kit";
import type { LordNavGate, LordPanelProps } from "../screen/lordScreenTypes";
import { useUiParts } from "../uiPartArt";
import { LORD_LEDGER_COPY as COPY } from "./ledgerCopy.ko";
import { ledgerView, PROMISE_MARK, type PromiseRow, type Shut, type SuitRow } from "./ledgerModel";

// LM-R2 (ledger area): the lord screen's 약속·소송 — the promise ledger (an open book: the promises to keep on the left
// page, the kept and broken on the right, the spine between them 24 px wide), the registry's timed terms, and the suit
// track (the lord's claims with the engine's filing refusal, his suits stage by stage with evidence, patron, hearing and
// enforcement, and the neighbours' suits against him, shown only). Every press is the game's own command; a press the
// game would refuse now is shut (ledgerModel `would`). The Wave 35 parts (wave35-promises, litigation_track) are drawn
// once loaded; until then, or when one fails, the kit's light frame and the text labels stand (uiPartArt).

export const LEDGER_PARTS = {
  book: "lord.ledger.ledger_book", spine: "lord.ledger.ledger_spine", deadline: "lord.ledger.deadline_marker", witness: "lord.ledger.witness_seal",
  debt: "lord.ledger.debt_note", track: "lord.ledger.litigation_track",
} as const;
const PART_IDS = [...Object.values(LEDGER_PARTS), ...Object.values(PROMISE_MARK)];

/** Open in lord mode (the host gates it too); an empty ledger is a screen of its own (its empty lines). */
export const ledgerGate: LordNavGate = state => lordMode(state) ? null : COPY.closed;

type Parts = ReturnType<typeof useUiParts>;
const Icon = ({ style, className }: { readonly style: CSSProperties | null; readonly className: string }) =>
  style === null ? null : <span className={className} aria-hidden="true" style={style} />;

function ShutLine({ shut }: { readonly shut: Shut }) {
  return shut.reason === null ? null : <span className="lord-ledger-shut" role="status">{shut.reason}</span>;
}

function PromiseItem({ row, parts, onKeep }: { readonly row: PromiseRow; readonly parts: Parts; readonly onKeep: (id: string) => void }) {
  return (
    <li className="lord-ledger-promise" data-promise={row.id} data-state={row.state} data-focused={row.focused ? "true" : undefined}
      aria-current={row.focused ? "true" : undefined}>
      <Icon className="lord-ledger-mark" style={parts.image(row.mark, 32)} />
      <div className="lord-ledger-promise-body">
        <p className="lord-ledger-promise-title"><span>{row.term}</span>{row.amount === null ? null : <span className="lord-ledger-amount">{row.amount}</span>}</p>
        <p className="lord-ledger-state" data-state-label={row.state}>{row.label}</p>
        <p className="lord-ledger-line">{row.party}</p>
        {row.deadline === null ? null : <p className="lord-ledger-line lord-ledger-deadline" data-due-today={row.dueToday ? "true" : undefined}>
          <Icon className="lord-ledger-inline-icon" style={parts.image(LEDGER_PARTS.deadline, 24)} />{row.deadline}</p>}
        {row.settled === null ? null : <p className="lord-ledger-line">{row.settled}</p>}
        {row.debt === null ? null : <p className="lord-ledger-line lord-ledger-debt"><Icon className="lord-ledger-inline-icon" style={parts.image(LEDGER_PARTS.debt, 32)} />{row.debt}</p>}
        {row.witnesses === null ? null : <p className="lord-ledger-line"><Icon className="lord-ledger-inline-icon" style={parts.image(LEDGER_PARTS.witness, 24)} />{row.witnesses}</p>}
        {row.state === "open" || row.state === "due" ? <p className="lord-ledger-line lord-ledger-stake">{row.stake}</p> : null}
        {row.keep === null ? (row.state === "open" || row.state === "due" ? <p className="lord-ledger-line">{COPY.theirs}</p> : null) : <div className="lord-ledger-action">
          <Button type="button" className="lord-ledger-keep" data-keep={row.id} variant="secondary" size="md" disabled={!row.keep.enabled}
            aria-label={COPY.keepLabel(row.term)} onPress={() => { if (row.keep?.enabled === true) onKeep(row.id); }}>{COPY.keep}</Button>
          <ShutLine shut={row.keep} />
        </div>}
      </div>
    </li>
  );
}

function SuitItem({ row, parts, dispatch }: { readonly row: SuitRow; readonly parts: Parts; readonly dispatch: LordPanelProps["dispatch"] }) {
  const track = parts.frame(LEDGER_PARTS.track);
  const evidence = row.evidence ?? [];
  const bringable = evidence.some(entry => entry.bring?.enabled === true);
  return (
    <li className="lord-ledger-suit" data-suit={row.id} data-claim={row.claimId} data-stage={row.stage} data-neighbour={row.neighbour ? "true" : undefined}
      data-focused={row.focused ? "true" : undefined} aria-current={row.focused ? "true" : undefined}>
      <p className="lord-ledger-suit-title">{row.what}</p>
      <p className="lord-ledger-line">{COPY.pair(row.party, row.since)}</p>
      <ol className="lord-ledger-track" aria-label={COPY.track} data-frame={track?.dataFrame ?? "light"} style={track?.style}>
        {row.track.map(step => <li key={step.stage} className="lord-ledger-step" data-step={step.stage} data-at={step.at}
          aria-current={step.at === "now" ? "step" : undefined}>{step.label}</li>)}
      </ol>
      {row.hearing === null ? null : <p className="lord-ledger-line" data-hearing="true">{COPY.pair(COPY.hearingHeading, row.hearing)}</p>}
      {row.verdict === null ? null : <p className="lord-ledger-line" data-verdict="true">{row.verdict}</p>}
      {row.evidence === null ? null : <div className="lord-ledger-block" data-block="evidence">
        <h5>{COPY.evidenceHeading}</h5>
        <ul className="lord-ledger-options">
          {evidence.filter(entry => entry.given !== null || bringable).map(entry => <li key={entry.kind} data-evidence={entry.kind}>
            <span className="lord-ledger-option-name">{entry.label}</span>
            {entry.given !== null ? <span className="lord-ledger-option-note" data-given="true">{entry.given}</span>
              : <Button type="button" className="lord-ledger-bring" data-bring={entry.kind} variant="secondary" size="md" disabled={entry.bring?.enabled !== true}
                aria-label={COPY.evidenceLabel(entry.label)} onPress={() => { if (entry.bring?.enabled === true) dispatch({ type: "add_suit_evidence", suitId: row.id, evidence: entry.kind }); }}>
                {COPY.evidenceBring}</Button>}
          </li>)}
        </ul>
        {bringable ? null : <span className="lord-ledger-shut" role="status">{COPY.keepShut}</span>}
      </div>}
      {row.patron === null ? null : <div className="lord-ledger-block" data-block="patron">
        <h5>{COPY.patronHeading}</h5>
        {row.patron.chosen !== null ? <p className="lord-ledger-line" data-patron="chosen">{row.patron.chosen}</p>
          : row.patron.options.length === 0 ? <p className="lord-ledger-line" data-patron="none">{COPY.patronNone}</p>
          : <ul className="lord-ledger-options">
            {row.patron.options.map(option => <li key={option.factionId} data-patron={option.factionId}>
              <span className="lord-ledger-option-name">{option.name}</span><span className="lord-ledger-option-note">{option.relation}</span>
              <Button type="button" className="lord-ledger-patron" data-seek={option.factionId} variant="secondary" size="md" aria-label={COPY.patronLabel(option.name)}
                onPress={() => dispatch({ type: "seek_suit_patron", suitId: row.id, factionId: option.factionId })}>{COPY.patronSeek}</Button>
            </li>)}
          </ul>}
      </div>}
      {row.enforce === null ? null : <div className="lord-ledger-block" data-block="enforce">
        <h5>{COPY.enforceHeading}</h5>
        {row.enforce.lines.map(line => <p key={line} className="lord-ledger-line">{line}</p>)}
        {row.enforce.button === null ? null : <div className="lord-ledger-action">
          <Button type="button" className="lord-ledger-enforce" data-enforce={row.id} variant="secondary" size="md" disabled={!row.enforce.button.enabled}
            aria-label={COPY.enforceLabel(row.what)} onPress={() => { if (row.enforce?.button?.enabled === true) dispatch({ type: "enforce_possession", suitId: row.id }); }}>
            {COPY.enforce}</Button>
          <ShutLine shut={row.enforce.button} />
        </div>}
      </div>}
      <p className="lord-ledger-line lord-ledger-costs">{row.costs}</p>
    </li>
  );
}

export function LedgerPanel({ state, dispatch, focus }: LordPanelProps): ReactElement | null {
  const parts = useUiParts(PART_IDS);
  // Rows for this state and focus. Cache (AGENTS rule 10): (a) key: the state object and the focus id; (b) nothing else
  // enters (the rows read only the state); (c) the reducer trials behind the buttons run once per state, not per paint.
  const view = useMemo(() => ledgerView(state, focus), [state, focus]);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus === null) return;
    root.current?.querySelector("[data-focused='true']")?.scrollIntoView({ block: "nearest" });
  }, [focus]);
  if (view === null) return null;
  const book = parts.frame(LEDGER_PARTS.book);
  const spine = parts.image(LEDGER_PARTS.spine, 24);
  const keep = (promiseId: string) => dispatch({ type: "keep_promise", promiseId });
  return (
    <section ref={root} className="lord-ledger" aria-label={COPY.regionLabel}>
      <section className="lord-ledger-section" data-section="promises">
        <header className="lord-ledger-heading"><h3>{COPY.promisesHeading}</h3><span className="lord-ledger-treasury" data-treasury="true">{view.treasury}</span></header>
        {view.promises.none ? <p className="lord-ledger-empty" data-empty="promises">{COPY.noPromises}</p> : null}
        <div className="lord-ledger-book" data-frame={book?.dataFrame ?? "light"} data-book-art={book === null ? "none" : "ledger_book"} style={book?.style}>
          <div className="lord-ledger-leaf" data-leaf="open">
            <h4>{COPY.openPage}</h4>
            {view.promises.open.length === 0 ? <p className="lord-ledger-empty">{COPY.noOpen}</p>
              : <ul className="lord-ledger-promises">{view.promises.open.map(row => <PromiseItem key={row.id} row={row} parts={parts} onKeep={keep} />)}</ul>}
          </div>
          <span className="lord-ledger-spine" aria-hidden="true" data-spine-art={spine === null ? "none" : "ledger_spine"}
            style={spine === null ? undefined : { ...spine, height: "auto" }} />
          <div className="lord-ledger-leaf" data-leaf="past">
            <h4>{COPY.pastPage}</h4>
            {view.promises.past.length === 0 ? <p className="lord-ledger-empty">{COPY.noPast}</p>
              : <ul className="lord-ledger-promises">{view.promises.past.map(row => <PromiseItem key={row.id} row={row} parts={parts} onKeep={keep} />)}</ul>}
          </div>
        </div>
      </section>
      <section className="lord-ledger-section" data-section="terms">
        <h3>{COPY.termsHeading}</h3>
        {view.terms.length === 0 ? <p className="lord-ledger-empty" data-empty="terms">{COPY.noTerms}</p>
          : <ul className="lord-ledger-terms">{view.terms.map(term => <li key={term.id} className="lord-ledger-term" data-term={term.id} data-running={term.running ? "true" : "false"}>
            <p className="lord-ledger-promise-title"><span>{COPY.pair(term.kind, term.what)}</span><span className="lord-ledger-amount">{term.amount}</span></p>
            <p className="lord-ledger-line">{term.years}</p><p className="lord-ledger-line">{term.end}</p>
          </li>)}</ul>}
      </section>
      <section className="lord-ledger-section" data-section="suits">
        <h3>{COPY.suitsHeading}</h3>
        <h4>{COPY.claimsHeading}</h4>
        {view.claims.length === 0 ? <p className="lord-ledger-empty" data-empty="claims">{COPY.noClaims}</p>
          : <ul className="lord-ledger-claims">{view.claims.map(claim => <li key={claim.id} className="lord-ledger-claim" data-claim={claim.id}
            data-focused={claim.focused ? "true" : undefined} aria-current={claim.focused ? "true" : undefined}>
            <div className="lord-ledger-claim-body"><p className="lord-ledger-suit-title">{claim.what}</p><p className="lord-ledger-line">{claim.line}</p></div>
            <div className="lord-ledger-action">
              <Button type="button" className="lord-ledger-file" data-file={claim.id} variant="secondary" size="md" disabled={claim.refusal !== null}
                aria-label={COPY.fileSuitLabel(claim.what)} onPress={() => { if (claim.refusal === null) dispatch({ type: "file_suit", claimId: claim.id }); }}>{COPY.fileSuit}</Button>
              {claim.refusal === null ? null : <span className="lord-ledger-shut" role="status" data-refusal="true">{claim.refusal}</span>}
            </div>
          </li>)}</ul>}
        {view.suits.length === 0 ? <p className="lord-ledger-empty" data-empty="suits">{COPY.noSuits}</p>
          : <ul className="lord-ledger-suits">{view.suits.map(row => <SuitItem key={row.id} row={row} parts={parts} dispatch={dispatch} />)}</ul>}
      </section>
      <section className="lord-ledger-section" data-section="neighbour-suits">
        <h3>{COPY.neighbourHeading}</h3>
        {view.neighbourSuits.length === 0 ? <p className="lord-ledger-empty" data-empty="neighbour-suits">{COPY.noNeighbour}</p> : <>
          <p className="lord-ledger-line">{COPY.neighbourNote}</p>
          <ul className="lord-ledger-suits">{view.neighbourSuits.map(row => <SuitItem key={row.id} row={row} parts={parts} dispatch={dispatch} />)}</ul>
        </>}
      </section>
    </section>
  );
}

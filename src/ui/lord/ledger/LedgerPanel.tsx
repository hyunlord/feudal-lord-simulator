import { useEffect, useMemo, useRef, type CSSProperties, type ReactElement } from "react";
import { lordMode } from "../../../engine/townAgency";
import { Button } from "../../kit";
import type { LordNavGate, LordPanelProps } from "../screen/lordScreenTypes";
import { useUiParts } from "../uiPartArt";
import { LORD_LEDGER_COPY as COPY } from "./ledgerCopy.ko";
import { ledgerView, PROMISE_MARK, type PromiseRow } from "./ledgerModel";
import { ClaimItem, ShutLine, SuitItem, ThreatsSection } from "./SuitItems";

// LM-R2 (ledger area): the lord screen's 약속·소송 — the promise ledger (an open book: the promises to keep on the left
// page, the kept and broken on the right, the spine between them 24 px wide), the registry's timed terms, and the suit
// track (the lord's claims with the engine's filing outlook, his suits stage by stage with evidence, patron, hearing and
// enforcement, the houses' suits against him with his defence, and the forcible entries forewarned — SuitItems.tsx).
// Every press is the game's own command; a press the game would refuse now is shut (the engine's reason, or `would`). The Wave 35 parts (wave35-promises, litigation_track) are drawn
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
  const fileSuit = (claimId: string) => dispatch({ type: "file_suit", claimId });
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
          : <ul className="lord-ledger-claims">{view.claims.map(claim => <ClaimItem key={claim.id} claim={claim} onFile={fileSuit} />)}</ul>}
        {view.suits.length === 0 ? <p className="lord-ledger-empty" data-empty="suits">{COPY.noSuits}</p>
          : <ul className="lord-ledger-suits">{view.suits.map(row => <SuitItem key={row.id} row={row} parts={parts} track={LEDGER_PARTS.track} dispatch={dispatch} />)}</ul>}
      </section>
      <section className="lord-ledger-section" data-section="neighbour-suits">
        <h3>{COPY.neighbourHeading}</h3>
        {view.neighbourSuits.length === 0 ? <p className="lord-ledger-empty" data-empty="neighbour-suits">{COPY.noNeighbour}</p>
          : <ul className="lord-ledger-suits">{view.neighbourSuits.map(row => <SuitItem key={row.id} row={row} parts={parts} track={LEDGER_PARTS.track} dispatch={dispatch} />)}</ul>}
      </section>
      {view.threats === null ? null : <ThreatsSection view={view.threats} dispatch={dispatch} />}
    </section>
  );
}

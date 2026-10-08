import type { ReactElement } from "react";
import type { Evidence } from "../../../engine/estates.types";
import type { GameAction } from "../../../state/gameStore.types";
import { Button } from "../../kit";
import type { LordPanelProps } from "../screen/lordScreenTypes";
import type { useUiParts } from "../uiPartArt";
import { LORD_LEDGER_COPY as COPY } from "./ledgerCopy.ko";
import type { Shut } from "./ledgerWords";
import { SUIT_DEFENCE_COPY as DEFENCE } from "./suitDefenceCopy.ko";
import type { DefenceRow, ThreatsView } from "./suitDefenceModel";
import type { ClaimRow, EvidenceRow, SuitRow } from "./suitsModel";

// LM-R2 (ledger area) the suit track's items: a claim to file, a suit stage by stage (the lord's with evidence, patron,
// hearing and enforcement; a house's against him with his defence — SUIT-THREAD, DTR-23), and the forcible entries
// forewarned. Every press is the game's own command, named where it is sent (B9 R4); a press the game would refuse now
// is shut with the engine's reason where it gives one. Equal choices (the concord's two terms, the guard and the gift)
// are both the kit's secondary button: neither is the screen's one primary.

type Parts = ReturnType<typeof useUiParts>;
type Dispatch = LordPanelProps["dispatch"];

export function ShutLine({ shut }: { readonly shut: Shut }) {
  return shut.reason === null ? null : <span className="lord-ledger-shut" role="status">{shut.reason}</span>;
}

/** A suit's evidence kinds: given (the weight), or the button with the kind's cost and weight; one line when none can come. */
function EvidenceList({ rows, shut, label, onBring }: { readonly rows: readonly EvidenceRow[]; readonly shut: string | null;
  readonly label: (kind: string, note: string) => string; readonly onBring: (kind: Evidence["kind"]) => void }) {
  return <>
    <ul className="lord-ledger-options">
      {rows.filter(entry => entry.given !== null || shut === null).map(entry => <li key={entry.kind} data-evidence={entry.kind}>
        <span className="lord-ledger-option-name">{entry.label}</span>
        {entry.given !== null ? <span className="lord-ledger-option-note" data-given="true">{entry.given}</span> : <>
          <span className="lord-ledger-option-note" data-evidence-note="true">{entry.note}</span>
          <Button type="button" className="lord-ledger-bring" data-bring={entry.kind} variant="secondary" size="md" disabled={entry.bring?.enabled !== true}
            aria-label={label(entry.label, entry.note)} onPress={() => { if (entry.bring?.enabled === true) onBring(entry.kind); }}>{COPY.evidenceBring}</Button>
          {entry.bring === null ? null : <ShutLine shut={entry.bring} />}
        </>}
      </li>)}
    </ul>
    {shut === null ? null : <span className="lord-ledger-shut" role="status" data-evidence-shut="true">{shut}</span>}
  </>;
}

/** DTR-23: the lord's moves in a house's suit against him — evidence, a patron, the final concord, the hold. */
function DefenceBlock({ suitId, what, row, command }: { readonly suitId: string; readonly what: string; readonly row: DefenceRow; readonly command: (action: GameAction) => void }) {
  return (
    <div className="lord-ledger-defence" data-block="defence" role="group" aria-label={DEFENCE.heading}>
      <div className="lord-ledger-block" data-block="defence-evidence">
        <h5>{DEFENCE.evidenceHeading}</h5>
        <EvidenceList rows={row.evidence} shut={row.evidenceShut} label={DEFENCE.evidenceLabel}
          onBring={kind => command({ type: "add_defence_evidence", suitId, evidence: kind })} />
      </div>
      <div className="lord-ledger-block" data-block="defence-patron">
        <h5>{DEFENCE.patronHeading}</h5>
        {row.patron.chosen !== null ? <p className="lord-ledger-line" data-patron="chosen">{row.patron.chosen}</p>
          : row.patron.options.length === 0 ? <span className="lord-ledger-shut" role="status" data-patron="none">{row.patron.shut ?? COPY.patronNone}</span>
          : <ul className="lord-ledger-options">
            {row.patron.options.map(option => <li key={option.factionId} data-patron={option.factionId}>
              <span className="lord-ledger-option-name">{option.name}</span><span className="lord-ledger-option-note">{option.note}</span>
              <Button type="button" className="lord-ledger-defend-patron" data-seek={option.factionId} variant="secondary" size="md"
                aria-label={DEFENCE.patronLabel(option.name, option.support)}
                onPress={() => command({ type: "seek_defence_patron", suitId, factionId: option.factionId })}>{COPY.patronSeek}</Button>
            </li>)}
          </ul>}
      </div>
      <div className="lord-ledger-block" data-block="concord">
        <h5>{DEFENCE.concordHeading}</h5>
        <p className="lord-ledger-line">{DEFENCE.concordNote}</p>
        <div className="lord-ledger-action">
          <Button type="button" className="lord-ledger-concord" data-concord="pay" variant="secondary" size="md" disabled={!row.concord.pay.enabled}
            aria-label={DEFENCE.payLabel(what, row.concord.price)}
            onPress={() => { if (row.concord.pay.enabled) command({ type: "settle_suit", suitId, terms: "pay" }); }}>{DEFENCE.pay(row.concord.price)}</Button>
          <Button type="button" className="lord-ledger-concord" data-concord="yield" variant="secondary" size="md" aria-label={DEFENCE.yieldLabel(what)}
            onPress={() => command({ type: "settle_suit", suitId, terms: "yield" })}>{DEFENCE.yieldPiece}</Button>
          <ShutLine shut={row.concord.pay} />
        </div>
      </div>
      <div className="lord-ledger-block" data-block="hold">
        <h5>{DEFENCE.holdHeading}</h5>
        <p className="lord-ledger-line">{row.hold.line}</p>
        <div className="lord-ledger-action">
          <Button type="button" className="lord-ledger-hold" data-hold={suitId} variant="secondary" size="md" disabled={!row.hold.button.enabled}
            aria-label={DEFENCE.holdLabel(what, row.hold.cost)}
            onPress={() => { if (row.hold.button.enabled) command({ type: "hold_possession", suitId }); }}>{DEFENCE.hold(row.hold.cost)}</Button>
          <ShutLine shut={row.hold.button} />
        </div>
      </div>
    </div>
  );
}

export function ClaimItem({ claim, onFile }: { readonly claim: ClaimRow; readonly onFile: (claimId: string) => void }) {
  return (
    <li className="lord-ledger-claim" data-claim={claim.id} data-novel={claim.novel === null ? undefined : "true"}
      data-focused={claim.focused ? "true" : undefined} aria-current={claim.focused ? "true" : undefined}>
      <div className="lord-ledger-claim-body"><p className="lord-ledger-suit-title">{claim.what}</p><p className="lord-ledger-line">{claim.line}</p>
        {claim.novel === null ? null : <p className="lord-ledger-line" data-novel-line="true">{claim.novel}</p>}
        {claim.hearing === null ? null : <p className="lord-ledger-line lord-ledger-claim-hearing" data-claim-hearing="true">{claim.hearing}</p>}</div>
      <div className="lord-ledger-action">
        <Button type="button" className="lord-ledger-file" data-file={claim.id} data-cost="true" variant="secondary" size="md"
          disabled={claim.refusal !== null} aria-label={COPY.fileSuitCostLabel(claim.what, claim.cost)}
          onPress={() => { if (claim.refusal === null) onFile(claim.id); }}>{COPY.fileSuitCost(claim.cost)}</Button>
        {claim.refusal === null ? null : <span className="lord-ledger-shut" role="status" data-refusal="true">{claim.refusal}</span>}
      </div>
    </li>
  );
}

export function SuitItem({ row, parts, track, dispatch }: { readonly row: SuitRow; readonly parts: Parts; readonly track: string; readonly dispatch: Dispatch }): ReactElement {
  // The lord's commands as the other lord screens send them: a press names the command, the game dispatches it (B9 R4).
  const command = (action: GameAction) => dispatch(action);
  const frame = parts.frame(track);
  return (
    <li className="lord-ledger-suit" data-suit={row.id} data-claim={row.claimId} data-stage={row.stage} data-neighbour={row.neighbour ? "true" : undefined}
      data-focused={row.focused ? "true" : undefined} aria-current={row.focused ? "true" : undefined}>
      <p className="lord-ledger-suit-title">{row.what}</p>
      <p className="lord-ledger-line">{COPY.pair(row.party, row.since)}</p>
      <ol className="lord-ledger-track" aria-label={COPY.track} data-frame={frame?.dataFrame ?? "light"} style={frame?.style}>
        {row.track.map(step => <li key={step.stage} className="lord-ledger-step" data-step={step.stage} data-at={step.at}
          aria-current={step.at === "now" ? "step" : undefined}>{step.label}</li>)}
      </ol>
      {row.hearing === null ? null : <p className="lord-ledger-line" data-hearing="true">{COPY.pair(COPY.hearingHeading, row.hearing)}</p>}
      {row.verdict === null ? null : <p className="lord-ledger-line" data-verdict="true">{row.verdict}</p>}
      {row.settled === null ? null : <p className="lord-ledger-line" data-settled="true">{row.settled}</p>}
      {row.evidence === null ? null : <div className="lord-ledger-block" data-block="evidence">
        <h5>{COPY.evidenceHeading}</h5>
        <EvidenceList rows={row.evidence} shut={row.evidenceShut} label={COPY.evidenceLabel}
          onBring={kind => command({ type: "add_suit_evidence", suitId: row.id, evidence: kind })} />
      </div>}
      {row.patron === null ? null : <div className="lord-ledger-block" data-block="patron">
        <h5>{COPY.patronHeading}</h5>
        {row.patron.chosen !== null ? <p className="lord-ledger-line" data-patron="chosen">{row.patron.chosen}</p>
          : row.patron.options.length === 0 ? <p className="lord-ledger-line" data-patron="none">{COPY.patronNone}</p>
          : <ul className="lord-ledger-options">
            {row.patron.options.map(option => <li key={option.factionId} data-patron={option.factionId}>
              <span className="lord-ledger-option-name">{option.name}</span><span className="lord-ledger-option-note">{option.relation}</span>
              <Button type="button" className="lord-ledger-patron" data-seek={option.factionId} variant="secondary" size="md" aria-label={COPY.patronLabel(option.name)}
                onPress={() => command({ type: "seek_suit_patron", suitId: row.id, factionId: option.factionId })}>{COPY.patronSeek}</Button>
            </li>)}
          </ul>}
      </div>}
      {row.enforce === null ? null : <div className="lord-ledger-block" data-block="enforce">
        <h5>{COPY.enforceHeading}</h5>
        {row.enforce.lines.map(line => <p key={line} className="lord-ledger-line">{line}</p>)}
        {row.enforce.button === null ? null : <div className="lord-ledger-action">
          <Button type="button" className="lord-ledger-enforce" data-enforce={row.id} variant="secondary" size="md" disabled={!row.enforce.button.enabled}
            aria-label={COPY.enforceLabel(row.what)} onPress={() => { if (row.enforce?.button?.enabled === true) command({ type: "enforce_possession", suitId: row.id }); }}>
            {COPY.enforce}</Button>
          <ShutLine shut={row.enforce.button} />
        </div>}
      </div>}
      {row.defence === null ? null : <DefenceBlock suitId={row.id} what={row.what} row={row.defence} command={command} />}
      {row.stageCosts === null ? null : <p className="lord-ledger-line lord-ledger-costs" data-stage-costs="true">{row.stageCosts}</p>}
      {row.neighbour ? null : <p className="lord-ledger-line lord-ledger-costs">{row.costs}</p>}
    </li>
  );
}

/** DTR-23 (S3): the forcible entries forewarned — the guard or the gift for each — and the last that ended, in the engine's words. */
export function ThreatsSection({ view, dispatch }: { readonly view: ThreatsView; readonly dispatch: Dispatch }) {
  const command = (action: GameAction) => dispatch(action);
  return (
    <section className="lord-ledger-section" data-section="entry-threats">
      <h3>{DEFENCE.threatsHeading}</h3>
      {view.threats.length === 0 ? null : <ul className="lord-ledger-suits">{view.threats.map(threat => <li key={threat.id} className="lord-ledger-threat" data-threat={threat.id}
        data-guarded={threat.guarded ? "true" : undefined} data-focused={threat.focused ? "true" : undefined} aria-current={threat.focused ? "true" : undefined}>
        <p className="lord-ledger-suit-title">{threat.title}</p>
        <p className="lord-ledger-line">{threat.when}</p>
        {threat.sentence === null ? null : <p className="lord-ledger-line" data-record="true">{threat.sentence}</p>}
        {threat.guarded ? <p className="lord-ledger-line" data-guarded-line="true">{DEFENCE.guarded}</p> : null}
        <div className="lord-ledger-action">
          {threat.guard === null ? null : <Button type="button" className="lord-ledger-guard" data-guard={threat.id} variant="secondary" size="md"
            disabled={!threat.guard.button.enabled} aria-label={DEFENCE.guardLabel(threat.what, threat.guard.cost)}
            onPress={() => { if (threat.guard?.button.enabled === true) command({ type: "guard_possession", threatId: threat.id }); }}>{DEFENCE.guard(threat.guard.cost)}</Button>}
          <Button type="button" className="lord-ledger-appease" data-appease={threat.id} variant="secondary" size="md"
            disabled={!threat.appease.button.enabled} aria-label={DEFENCE.appeaseLabel(threat.house, threat.appease.cost)}
            onPress={() => { if (threat.appease.button.enabled) command({ type: "appease_neighbour", threatId: threat.id }); }}>{DEFENCE.appease(threat.appease.cost)}</Button>
          {[threat.guard?.button, threat.appease.button].filter(button => button !== undefined && !button.enabled).slice(0, 1)
            .map(button => <ShutLine key="shut" shut={button!} />)}
        </div>
      </li>)}</ul>}
      {view.past.length === 0 ? null : <div className="lord-ledger-block" data-block="past-entries">
        <h4>{DEFENCE.pastHeading}</h4>
        {view.past.map(entry => <p key={entry.id} className="lord-ledger-line" data-record="true">{entry.line}</p>)}
      </div>}
    </section>
  );
}

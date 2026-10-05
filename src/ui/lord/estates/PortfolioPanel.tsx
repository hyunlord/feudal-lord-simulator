import { useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { HOME_ESTATE_ID } from "../../../content/estateConfig";
import type { GameState } from "../../../engine/engine.types";
import { estatePerson } from "../../../engine/estates";
import { lordMode } from "../../../engine/townAgency";
import type { GameAction } from "../../../state/gameStore.types";
import { Button, Card, Toggle } from "../../kit";
import { lordPersonRow, lordPortraitStyle, type LordPersonRow } from "../screen/lordPortrait";
import type { LordNavGate, LordPanelProps } from "../screen/lordScreenTypes";
import { useUiParts } from "../uiPartArt";
import {
  ALERT_WIDTH, alertIconId, AUDIT_PICTURE_ID, AUDIT_PICTURE_WIDTH, ESTATE_OVERLAY_ID, ESTATE_PICTURE_WIDTH, estatePictureId, OFFICE_WIDTH, officeIconId,
  PORTFOLIO_ART_IDS, TRAIT_WIDTH, traitIconId, type AlertIcon,
} from "./estatesArt";
import { ESTATES_COPY as COPY } from "./estatesCopy.ko";
import type { EstateCardView } from "./estatesModel";
import {
  portfolioView, RULE_FIRST, ruleAmountStep, rulesCommand, type CandidateRow, type OfficeId, type OversightPanel, type PortfolioView,
} from "./oversightModel";

// LM-R2 (estates area): the lord screen's 영지 — the portfolio (ES-10) and its operations (SW-8). The estates as a row of
// choices; the chosen one's card (picture, title and possession, worth, burdens, pieces, grants, claims); a held estate's
// oversight (mode, the keeper and candidates, the audit, the last eight seasons); the attention; the exceptions; the
// petitions waiting for the lord (listed: their decision cards are the lead's). Every control sends the engine's own
// command; no button here is primary (the choices are equal, LR1-D2). A deep link's estateId selects its card.

type Parts = ReturnType<typeof useUiParts>;

export const portfolioGate: LordNavGate = state => lordMode(state) ? null : COPY.shut;

function Icon({ style, className }: { readonly style: CSSProperties | null; readonly className: string }): ReactElement | null {
  return style === null ? null : <span className={`lord-estates-icon ${className}`} aria-hidden="true" style={style} />;
}

const alert = (parts: Parts, id: AlertIcon) => <Icon style={parts.image(alertIconId(id), ALERT_WIDTH)} className="lord-estates-alert" />;

function Face({ row, size }: { readonly row: LordPersonRow | null; readonly size: number }): ReactElement | null {
  const style = row === null ? null : lordPortraitStyle(row, size);
  return style === null ? null : <span className="lord-estates-face" aria-hidden="true" style={{ ...style, width: size, height: size }} />;
}

function Totals({ view }: { readonly view: PortfolioView }): ReactElement {
  const items = [[COPY.totals.estates, view.totals.estates], [COPY.totals.value, view.totals.value], [COPY.totals.attention, view.totals.attention],
    [COPY.totals.audit, view.totals.audit]] as const;
  return <dl className="lord-estates-totals">
    {items.map(([label, value]) => <div key={label} className="lord-estates-total"><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}

function Attention({ view, parts }: { readonly view: PortfolioView; readonly parts: Parts }): ReactElement {
  const { attention } = view;
  const share = Math.min(100, Math.round(attention.load / Math.max(1, attention.capacity) * 100));
  return <section className="lord-estates-attention" aria-label={COPY.attentionHeading} data-overloaded={attention.overloaded ? "true" : "false"}>
    <h4>{COPY.attentionHeading}</h4>
    <p className="lord-estates-line" data-attention-load={attention.load} data-attention-capacity={attention.capacity}>{attention.line}</p>
    <div className="lord-estates-bar" aria-hidden="true"><span className="lord-estates-bar-fill" style={{ width: `${share}%` }} /></div>
    <ul className="lord-estates-reasons">
      {attention.reasons.map(reason => <li key={reason.name} data-reason={reason.name}>{reason.label} {reason.value}</li>)}
    </ul>
    {attention.warning === null ? null : <p className="lord-estates-warning" role="status">{alert(parts, "urgent")}<span>{attention.warning}</span></p>}
  </section>;
}

function Picker({ cards, selected, onSelect }: { readonly cards: readonly EstateCardView[]; readonly selected: string; readonly onSelect: (id: string) => void }): ReactElement {
  return <div className="lord-estates-picker" role="group" aria-label={COPY.cardsLabel}>
    {cards.map(card => <Button key={card.estateId} type="button" className="lord-estates-pick" variant="tab" data-estate={card.estateId}
      data-standing={card.standing} aria-pressed={card.estateId === selected} aria-label={COPY.cardChoose(card.name)} onPress={() => onSelect(card.estateId)}>
      <span className="lord-estates-pick-name">{card.name}</span><span className="lord-estates-pick-standing">{card.standingLine}</span>
    </Button>)}
  </div>;
}

function EstateCard({ state, card, parts }: { readonly state: GameState; readonly card: EstateCardView; readonly parts: Parts }): ReactElement {
  const picture = parts.image(estatePictureId(card.picture), ESTATE_PICTURE_WIDTH);
  const overlay = card.overlay ? parts.image(ESTATE_OVERLAY_ID, ESTATE_PICTURE_WIDTH) : null;
  const lord = card.houseLordId === null ? undefined : estatePerson(state, card.houseLordId);
  const facts: readonly (readonly [string, string, string])[] = [
    ["title", COPY.title, card.titleHolder], ["possessor", COPY.possessor, card.possessor],
    ...(card.lifeTenant === null ? [] : [["life-tenant", COPY.lifeTenant, card.lifeTenant] as const]),
    ...(card.remainder === null ? [] : [["remainder", COPY.remainder, card.remainder] as const]),
    ["value", COPY.annualValue, card.annualValueLine], ["burdens", COPY.burdens, card.burdensLine], ["claims", COPY.claims, card.claimsLine],
  ];
  return <Card className="lord-estates-card" data-estate-card={card.estateId} data-picture={card.picture} data-overlay={card.overlay ? "true" : "false"}
    aria-label={card.name}>
    <div className="lord-estates-card-top">
      <div className="lord-estates-picture" data-art={picture === null ? "none" : card.picture} style={picture ?? undefined}>
        {overlay === null ? null : <span className="lord-estates-overlay" data-art="integrated_overlay" style={overlay} />}
        {picture === null ? <span className="lord-estates-picture-kind">{card.kindName}</span> : null}
      </div>
      <div className="lord-estates-card-head">
        <h4>{card.name}</h4>
        <p className="lord-estates-line">{card.kindName} · {card.manorsLine} · {card.standingLine}</p>
        {lord === undefined ? null : <p className="lord-estates-house"><Face row={lordPersonRow(state, lord)} size={40} />
          <span>{lordPersonRow(state, lord).name}</span></p>}
        {card.overlay ? <p className="lord-estates-line" data-integrated="true">{COPY.integrated}</p> : null}
      </div>
    </div>
    <dl className="lord-estates-facts">
      {facts.map(([key, label, value]) => <div key={key} className="lord-estates-fact" data-fact={key}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <h5>{COPY.pieces}</h5>
    <table className="lord-estates-pieces">
      <thead><tr><th scope="col">{COPY.pieces}</th><th scope="col">{COPY.titlePossessor}</th><th scope="col">{COPY.annualValue}</th><th scope="col">{COPY.claims}</th></tr></thead>
      <tbody>
        {card.pieces.map(piece => <tr key={piece.id} data-piece={piece.id} data-possessor={piece.possessorId}>
          <th scope="row">{piece.name}</th>
          <td>{COPY.pieceHolders(piece.titleHolder, piece.possessor)}{piece.lifeTenant === null ? null : <span className="lord-estates-note">{COPY.lifeTenant} {piece.lifeTenant}</span>}
            {piece.note === null ? null : <span className="lord-estates-note">{piece.note}</span>}</td>
          <td>{piece.yearValueLine}</td><td>{COPY.claimsCount(piece.claims)}</td>
        </tr>)}
      </tbody>
    </table>
    {card.grants.length === 0 ? null : <>
      <h5>{COPY.grantsHeading(card.grants.length)}</h5>
      <ul className="lord-estates-grants">{card.grants.map(grant => <li key={grant.id}>{grant.line}</li>)}</ul>
    </>}
  </Card>;
}

function Person({ row, parts, office }: { readonly row: CandidateRow; readonly parts: Parts; readonly office: OfficeId | null }): ReactElement {
  return <div className="lord-estates-person">
    {office === null ? null : <Icon style={parts.image(officeIconId(office), OFFICE_WIDTH)} className="lord-estates-office" />}
    <Face row={row.person} size={48} />
    <span className="lord-estates-person-text">
      <span className="lord-estates-person-name" data-person={row.personId}>{office === null ? row.name : COPY.keeperName(COPY.offices[office], row.name)}</span>
      <span className="lord-estates-line">{row.abilityLine} · {row.connection}</span>
      <span className="lord-estates-disposition" data-disposition={row.disposition}>
        {row.trait === null ? null : <Icon style={parts.image(traitIconId(row.trait), TRAIT_WIDTH)} className="lord-estates-trait" />}{row.dispositionName}
      </span>
    </span>
  </div>;
}

function Oversight({ panel, parts, command }: { readonly panel: OversightPanel; readonly parts: Parts; readonly command: (action: GameAction) => void }): ReactElement {
  const picture = panel.pending === null ? null : parts.image(AUDIT_PICTURE_ID, AUDIT_PICTURE_WIDTH);
  return <section className="lord-estates-oversight" aria-label={`${panel.estateName} ${COPY.oversightHeading}`} data-oversight={panel.mode}>
    <h4>{COPY.oversightHeading}</h4>
    <div className="lord-estates-choices">
      {panel.modes.map(entry => <Button key={entry.mode} type="button" className="lord-estates-mode" variant="toggle" data-mode={entry.mode}
        aria-pressed={entry.chosen} aria-label={entry.aria} onPress={() => { if (entry.command !== null) command(entry.command); }}>{entry.label}</Button>)}
    </div>
    {panel.keeper === null ? <p className="lord-estates-line">{COPY.stewardNone}</p>
      : <div className="lord-estates-keeper" data-office={panel.office}><Person row={panel.keeper} parts={parts} office={panel.office} /></div>}
    <h5>{COPY.candidates}</h5>
    <ul className="lord-estates-candidates">
      {panel.candidates.flatMap(row => row.appoint === null ? [] : [{ row, appoint: row.appoint }]).map(({ row, appoint }) =>
        <li key={row.personId} data-candidate={row.personId}>
          <Person row={row} parts={parts} office={null} />
          <Button type="button" className="lord-estates-appoint" variant="secondary" aria-label={row.appointLabel} onPress={() => command(appoint)}>{row.appointText}</Button>
        </li>)}
    </ul>
    <h5>{COPY.auditHeading}</h5>
    <div className="lord-estates-choices">
      {panel.auditModes.map(entry => <Button key={entry.mode} type="button" className="lord-estates-audit-mode" variant="toggle" data-audit-mode={entry.mode}
        aria-pressed={entry.chosen} aria-label={entry.aria} onPress={() => { if (entry.command !== null) command(entry.command); }}>{entry.label}</Button>)}
    </div>
    <p className="lord-estates-line">{COPY.visitCost}</p>
    {panel.pending === null ? null : <div className="lord-estates-pending" role="status" data-pending-audit={panel.pending.auditId} data-audit-mode={panel.pending.mode}>
      {picture === null ? null : <span className="lord-estates-audit-art" data-art="annual_audit" aria-hidden="true" style={picture} />}
      <p className="lord-estates-pending-head">{alert(parts, "deadline")}<strong>{COPY.auditPending}</strong></p>
      <p className="lord-estates-line">{panel.pending.line}</p>
    </div>}
    <p className="lord-estates-line" data-last-audit="true">{COPY.lastAudit}: {panel.lastAudit === null ? COPY.noAuditYet : panel.lastAudit.line}</p>
    {panel.lastAudit?.found == null ? null : <p className="lord-estates-line">{panel.lastAudit.found}</p>}
    <h5>{COPY.summaryHeading}</h5>
    {panel.summaries.length === 0 ? <p className="lord-estates-line">{COPY.summaryNone}</p> : <>
      <table className="lord-estates-summaries">
        <thead><tr>{[COPY.summaryCols.season, COPY.summaryCols.mode, COPY.summaryCols.reported, COPY.summaryCols.rates, COPY.summaryCols.goodwill, COPY.summaryCols.petitions]
          .map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{panel.summaries.map(row => <tr key={row.tick} data-summary={row.tick} data-overloaded={row.overloaded ? "true" : "false"}>
          <th scope="row">{row.season}{row.overloaded ? <span className="lord-estates-note">{COPY.summaryOverloaded}</span> : null}</th>
          <td>{row.mode}</td><td>{row.reported}</td><td>{row.rates}</td><td>{row.goodwill}</td><td>{row.petitions}</td>
        </tr>)}</tbody>
      </table>
      <p className="lord-estates-line">{COPY.summaryHidden}</p>
    </>}
  </section>;
}

function Rules({ state, view, command }: { readonly state: GameState; readonly view: PortfolioView; readonly command: (action: GameAction) => void }): ReactElement | null {
  const rules = view.rules;
  if (rules === null) return null;
  return <section className="lord-estates-rules" aria-label={COPY.rulesHeading}>
    <h4>{COPY.rulesHeading}</h4>
    <p className="lord-estates-line">{COPY.rulesIntro}</p>
    <div className="lord-estates-rule-amount">
      <Toggle className="lord-estates-rule" data-rule="amount" checked={rules.amountAtLeast !== null} label={COPY.ruleAmountToggle}
        onChange={on => command(rulesCommand(state, { amountAtLeast: on ? RULE_FIRST : null }))} />
      <Button type="button" className="lord-estates-step" variant="icon" data-rule-step="less" aria-label={COPY.ruleAmountLess} disabled={!rules.canLess}
        onPress={() => command(rulesCommand(state, { amountAtLeast: ruleAmountStep(rules.amountAtLeast, -1) }))}>{COPY.minus}</Button>
      <span className="lord-estates-rule-line" data-rule-amount={rules.amountAtLeast ?? "none"}>{rules.amountLine}</span>
      <Button type="button" className="lord-estates-step" variant="icon" data-rule-step="more" aria-label={COPY.ruleAmountMore} disabled={!rules.canMore}
        onPress={() => command(rulesCommand(state, { amountAtLeast: ruleAmountStep(rules.amountAtLeast, 1) }))}>{COPY.plus}</Button>
    </div>
    <div className="lord-estates-choices">
      <Toggle className="lord-estates-rule" data-rule="rights" checked={rules.rights} label={COPY.ruleRights} onChange={on => command(rulesCommand(state, { rights: on }))} />
      <Toggle className="lord-estates-rule" data-rule="marriage" checked={rules.marriage} label={COPY.ruleMarriage} onChange={on => command(rulesCommand(state, { marriage: on }))} />
      <Toggle className="lord-estates-rule" data-rule="recurring" checked={rules.recurring} label={COPY.ruleRecurring} onChange={on => command(rulesCommand(state, { recurring: on }))} />
    </div>
  </section>;
}

function Petitions({ view, parts }: { readonly view: PortfolioView; readonly parts: Parts }): ReactElement {
  return <section className="lord-estates-petitions" aria-label={COPY.petitionsHeading}>
    <h4>{COPY.petitionsHeading}</h4>
    {view.petitions.length === 0 ? <p className="lord-estates-line">{COPY.petitionsNone}</p>
      : <ul>{view.petitions.map(petition => <li key={petition.id} data-petition={petition.id} data-petition-estate={petition.estateId}>
        {petition.rights ? alert(parts, "rights") : null}{petition.days <= 30 ? alert(parts, "deadline") : null}<span>{petition.line}</span>
      </li>)}</ul>}
  </section>;
}

export function PortfolioPanel({ state, dispatch, focus }: LordPanelProps): ReactElement {
  const parts = useUiParts(PORTFOLIO_ART_IDS);
  const [selected, setSelected] = useState<string>(focus ?? HOME_ESTATE_ID);
  useEffect(() => { if (focus !== null) setSelected(focus); }, [focus]);
  const view = portfolioView(state);
  const card = view.cards.find(entry => entry.estateId === selected) ?? view.cards[0]!;
  const panel = view.oversight.get(card.estateId) ?? null;
  // The lord's commands (as the policy tab's): a press names the command, the game dispatches it.
  const command = (action: GameAction) => dispatch(action);
  return <div className="lord-estates" data-lord-estates={card.estateId}>
    <header className="lord-estates-head"><h3>{COPY.heading}</h3><p className="lord-estates-line">{COPY.intro}</p></header>
    <Totals view={view} />
    <Attention view={view} parts={parts} />
    <Picker cards={view.cards} selected={card.estateId} onSelect={setSelected} />
    <EstateCard state={state} card={card} parts={parts} />
    {panel === null ? null : <Oversight panel={panel} parts={parts} command={command} />}
    <Rules state={state} view={view} command={command} />
    <Petitions view={view} parts={parts} />
  </div>;
}

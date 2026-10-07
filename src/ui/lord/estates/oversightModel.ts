import type { GameState } from "../../../engine/engine.types";
import { estatePerson } from "../../../engine/estates";
import { calendar, scenarioOf } from "../../../engine/scenarioState";
import { attention, lordEstatePetitions, nextMichaelmas, oversightViews, pendingAudits, stewardCandidates, stewardshipOf } from "../../../engine/stewardship";
import type { AuditRecord, ExceptionRules, OversightMode, QuarterSummary, StewardDisposition } from "../../../engine/stewardship.types";
import type { GameAction } from "../../../state/gameStore.types";
import { calendarDays } from "../../gameTimeCopy.ko";
import { moneyFull } from "../../money.ko";
import { lordPersonRow, type LordPersonRow } from "../screen/lordPortrait";
import { ESTATES_COPY as COPY } from "./estatesCopy.ko";
import { estateCards, type EstateCardView } from "./estatesModel";
import { perState } from "../../perState";

// LM-R2 (estates area, SW-8): the portfolio's operations — the attention (SW-1), each held estate's oversight with its
// steward and candidates (SW-2, SW-3), the audit (SW-6), the season summaries (SW-7), the lord's exceptions (SW-5) and
// the estate petitions waiting for him (SW-4, listed only: the decision cards are the lead's). Read from the engine's
// read models only; each control carries the engine's own command.
//
// The season summary shows what the lord sees: the accounts (what reached the treasury), the rates, the goodwill, the
// petitions, the overload. What the steward kept back, the errors and the true yield stay off the screen: the audit is
// what reveals them (SW-6 "빼돌림은 찾았을 때만 드러난다"); of an audit only what it found, never what stayed hidden.

export type OfficeId = "receiver" | "steward";
/** A disposition's trait icon (lord-components-ui): only the two the engine's StewardDisposition names. */
export type TraitIcon = "merchant_friendly" | "peasant_friendly";
const TRAIT_OF: Readonly<Record<StewardDisposition, TraitIcon | null>> = { merchant: "merchant_friendly", peasant: "peasant_friendly", greedy: null };

export type CandidateRow = Readonly<{
  personId: string; name: string; person: LordPersonRow | null;
  ability: number; loyalty: number; abilityLine: string;
  disposition: StewardDisposition; dispositionName: string; trait: TraitIcon | null;
  connection: string; serving: boolean;
  /** The command that puts him in charge under the current mode (null for the one serving). */
  appoint: GameAction | null; appointText: string; appointLabel: string;
}>;

export type SummaryRow = Readonly<{
  tick: number; season: string; mode: string; reported: string; rates: string; goodwill: string; petitions: string; overloaded: boolean;
}>;

export type OversightPanel = Readonly<{
  estateId: string; estateName: string;
  mode: OversightMode; modeLine: string;
  modes: readonly Readonly<{ mode: OversightMode; label: string; chosen: boolean; command: GameAction | null; aria: string }>[];
  /** Who keeps the estate's accounts: the receiver of a direct estate, the steward of a delegated one. */
  office: OfficeId; officeName: string; keeper: CandidateRow | null;
  candidates: readonly CandidateRow[];
  auditMode: "accounts" | "visit";
  auditModes: readonly Readonly<{ mode: "accounts" | "visit"; label: string; chosen: boolean; command: GameAction | null; aria: string }>[];
  lastAudit: Readonly<{ line: string; found: string | null }> | null;
  /** An audit waiting for the lord's answer (answered on the lead's decision card): its facts. */
  pending: Readonly<{ auditId: string; mode: "accounts" | "visit"; line: string; days: number }> | null;
  summaries: readonly SummaryRow[];
}>;

export type AttentionView = Readonly<{
  capacity: number; load: number; overloaded: boolean; line: string; warning: string | null;
  reasons: readonly Readonly<{ name: string; label: string; value: string }>[];
}>;

export type RulesView = Readonly<{
  amountAtLeast: number | null; amountLine: string; canLess: boolean; canMore: boolean;
  rights: boolean; marriage: boolean; recurring: boolean;
}>;

export type PetitionRow = Readonly<{ id: string; estateId: string; line: string; rights: boolean; marriage: boolean; days: number }>;

export type PortfolioView = Readonly<{
  cards: readonly EstateCardView[];
  totals: Readonly<{ estates: string; value: string; attention: string; audit: string }>;
  attention: AttentionView;
  /** The held off-map estates' oversight, by estateId. */
  oversight: ReadonlyMap<string, OversightPanel>;
  rules: RulesView | null;
  petitions: readonly PetitionRow[];
}>;

/** The exceptions' amount: a pound a step, from £1 to £20; switched on at £5 (SW-5's example). */
export const RULE_STEP = 240;
export const RULE_MIN = 240;
export const RULE_MAX = 4800;
export const RULE_FIRST = 1200;

const seasonLabel = (state: GameState, tick: number): string => {
  const date = calendar(tick, scenarioOf(state).startYear);
  return COPY.summarySeason(date.year, COPY.seasons[date.season] ?? "");
};
const yearOf = (state: GameState, tick: number): number => calendar(tick, scenarioOf(state).startYear).year;
const nameOf = (state: GameState, personId: string): string => {
  const person = estatePerson(state, personId);
  return person === undefined ? COPY.stewardNone : lordPersonRow(state, person).name;
};

export function attentionView(state: GameState): AttentionView {
  const now = attention(state);
  return { capacity: now.capacity, load: now.load, overloaded: now.overloaded, line: COPY.attentionBar(now.load, now.capacity),
    warning: now.overloaded ? COPY.overloaded : null,
    reasons: now.reasons.map(reason => ({ name: reason.name, label: COPY.attentionReasons[reason.name], value: COPY.reasonValue(reason.value) })) };
}

function summaryRow(state: GameState, summary: QuarterSummary): SummaryRow {
  return { tick: summary.tick, season: seasonLabel(state, summary.tick), mode: COPY.modes[summary.mode], reported: moneyFull(summary.reported),
    rates: COPY.rates(summary.rentPermille, summary.duesPermille), goodwill: COPY.goodwill(summary.tenants, summary.merchants),
    petitions: COPY.summaryPetitions(summary.petitions.length), overloaded: summary.overloaded };
}

/** An audit as the lord knows it: what it found (never what stayed hidden: `hidden` is the engine's, SW-6). */
function auditLines(state: GameState, audit: AuditRecord): Readonly<{ line: string; found: string | null }> {
  const found = audit.revealedKept + audit.revealedErrors > 0 ? COPY.auditFound(moneyFull(audit.revealedKept), moneyFull(audit.revealedErrors)) : null;
  return { line: COPY.auditLine(yearOf(state, audit.tick), COPY.auditModes[audit.mode], COPY.auditStatus[audit.status]), found };
}

function oversightPanel(state: GameState, card: EstateCardView): OversightPanel | null {
  const view = oversightViews(state).find(entry => entry.estateId === card.estateId);
  if (view === undefined) return null;
  const { mode, stewardId, auditMode } = view.oversight;
  const candidates = stewardCandidates(state, card.estateId).map(({ record, person }): CandidateRow => {
    const name = person === undefined ? COPY.stewardNone : lordPersonRow(state, person).name;
    const serving = record.personId === stewardId;
    return {
      personId: record.personId, name, person: person === undefined ? null : lordPersonRow(state, person),
      ability: record.ability, loyalty: record.loyalty, abilityLine: COPY.candidateLine(record.ability, record.loyalty),
      disposition: record.disposition, dispositionName: COPY.dispositions[record.disposition], trait: TRAIT_OF[record.disposition],
      connection: record.connection === null ? COPY.noConnection : COPY.connection(COPY.connections[record.connection] ?? record.connection), serving,
      appoint: serving ? null : { type: "set_estate_oversight", estateId: card.estateId, mode, stewardId: record.personId },
      appointText: mode === "direct" ? COPY.appointReceiver : COPY.appoint, appointLabel: COPY.appointLabel(name, card.name, mode === "direct" ? COPY.receiver : COPY.steward),
    };
  });
  const pending = pendingAudits(state).find(audit => audit.estateId === card.estateId);
  const office: OfficeId = mode === "direct" ? "receiver" : "steward";
  return {
    estateId: card.estateId, estateName: card.name, mode, modeLine: COPY.modes[mode],
    modes: (["direct", "steward"] as const).map(entry => ({ mode: entry, label: COPY.modes[entry], chosen: entry === mode, aria: COPY.modeChoose(COPY.modes[entry]),
      command: entry === mode ? null : { type: "set_estate_oversight", estateId: card.estateId, mode: entry } })),
    office, officeName: COPY.offices[office], keeper: candidates.find(row => row.serving) ?? null, candidates,
    auditMode,
    auditModes: (["accounts", "visit"] as const).map(entry => ({ mode: entry, label: COPY.auditModes[entry], chosen: entry === auditMode, aria: COPY.auditModeChoose(COPY.auditModes[entry]),
      command: entry === auditMode ? null : { type: "set_audit_mode", estateId: card.estateId, mode: entry } })),
    lastAudit: view.lastAudit === undefined ? null : auditLines(state, view.lastAudit),
    pending: pending === undefined ? null : { auditId: pending.id, mode: pending.mode,
      line: COPY.auditPendingLine(nameOf(state, pending.stewardId), moneyFull(pending.revealedKept + pending.revealedErrors), calendarDays(pending.deadline - state.tick)),
      days: calendarDays(pending.deadline - state.tick) },
    summaries: stewardshipOf(state).summaries.filter(entry => entry.estateId === card.estateId).slice(-8).reverse().map(entry => summaryRow(state, entry)),
  };
}

export function rulesView(state: GameState): RulesView | null {
  if (state.stewardship === undefined) return null;
  const rules = stewardshipOf(state).rules;
  const amount = rules.amountAtLeast;
  return { amountAtLeast: amount, amountLine: amount === null ? COPY.ruleAmountOff : COPY.ruleAmount(moneyFull(amount)),
    canLess: amount !== null && amount > RULE_MIN, canMore: amount !== null && amount < RULE_MAX,
    rights: rules.rights, marriage: rules.marriage, recurring: rules.recurring === true };
}

/** The exceptions with one change (the command carries every field, as `set_exception_rules` takes them). */
export function rulesCommand(state: GameState, change: Partial<ExceptionRules>): GameAction {
  const rules = stewardshipOf(state).rules;
  return { type: "set_exception_rules", rules: { amountAtLeast: rules.amountAtLeast, rights: rules.rights, marriage: rules.marriage,
    ...(rules.recurring === undefined ? {} : { recurring: rules.recurring }), ...change } };
}

/** The amount stepped by a pound, kept in RULE_MIN…RULE_MAX (null stays null). */
export const ruleAmountStep = (amount: number | null, direction: -1 | 1): number | null =>
  amount === null ? null : Math.min(RULE_MAX, Math.max(RULE_MIN, amount + direction * RULE_STEP));

/** Once per state (`perState`): the 영지 screen re-renders on clock and UI events within a tick; this walks every estate,
 * its oversight, candidates and eight summaries (0.3-0.8 ms on the lord2 states, Mac). It holds only text and ids. */
export const portfolioView = perState((state: GameState): PortfolioView => {
  const cards = estateCards(state);
  const held = cards.filter(card => card.home || card.oversight !== null);
  const now = attentionView(state);
  const oversight = new Map(held.flatMap(card => { const panel = oversightPanel(state, card); return panel === null ? [] : [[card.estateId, panel] as const]; }));
  const names = new Map(cards.map(card => [card.estateId, card.name]));
  const waiting = pendingAudits(state).length > 0;
  return {
    cards,
    totals: { estates: COPY.estateCount(held.length), value: moneyFull(held.reduce((sum, card) => sum + card.annualValue, 0)),
      attention: COPY.attentionLine(now.load, now.capacity),
      audit: waiting ? COPY.auditPending : oversight.size === 0 ? COPY.noAudit : COPY.untilAudit(calendarDays(nextMichaelmas(state.tick) - state.tick)) },
    attention: now, oversight, rules: rulesView(state),
    petitions: lordEstatePetitions(state).map(petition => {
      const days = calendarDays(petition.deadline - state.tick);
      return { id: petition.id, estateId: petition.estateId, rights: petition.rights, marriage: petition.marriage, days,
        line: COPY.petitionLine(names.get(petition.estateId) ?? petition.estateId, COPY.petitionKinds[petition.kind], moneyFull(petition.amount), days) };
    }),
  };
});

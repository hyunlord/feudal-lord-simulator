import { BALANCE } from "../../../content/balanceConfig";
import type { PromiseRecord } from "../../../engine/diplomacy.types";
import type { GameState } from "../../../engine/engine.types";
import { LORD } from "../../../engine/estates";
import { diplomacyOf } from "../../../engine/negotiation";
import { registryOf } from "../../../engine/registry";
import type { RegistryTerm } from "../../../engine/registry.types";
import { scenarioOf } from "../../../engine/scenarioState";
import { lordMode } from "../../../engine/townAgency";
import { treasuryBalance } from "../../../ledger/ledger";
import { calendarArrivalLabel } from "../../calendarArrival";
import { durationLabel } from "../../gameTimeCopy.ko";
import { moneyFull, moneyShort } from "../../money.ko";
import { LORD_LEDGER_COPY as COPY, type PromiseState } from "./ledgerCopy.ko";
import { dateLabel, holderName, shut, would, type Shut } from "./ledgerWords";
import { threatsView, type ThreatsView } from "./suitDefenceModel";
import { suitsView, type ClaimRow, type SuitRow } from "./suitsModel";

export { dateLabel, holderName, would, type Shut } from "./ledgerWords";
export { SUIT_TRACK, type ClaimRow, type EvidenceRow, type PatronRow, type SuitRow, type TrackStep } from "./suitsModel";

// LM-R2 (ledger area): the lord screen's promises and suits as pure rows read from the engine's read models —
// `diplomacyOf(state).promises` (NG-6), `registryOf(state).terms` (ER-7), the estates' claims and suits with
// `fileSuitRefusal` and `suitHearing` (ES-7) and the neighbours' suits against the lord (ER-21, display only).
// No engine rule is copied here: whether a press would do anything is the game's own reducer tried on the current state
// (`would`: the same command the button sends; a refused command hands back the same state object). Where the engine
// exposes no reason (keepPromiseRefusal, suitActions: filed, docs/requests/engine-lmr2-seen-and-reads.md) the button is
// shut with a neutral line, never a guessed cause. The suit rows (claims, the lord's suits, the houses' against him with
// his defence; SUIT-THREAD) are suitsModel.ts, the forcible entries forewarned suitDefenceModel.ts, the shared words
// ledgerWords.ts.

/** NG-6 has no "due" status: an open promise is shown due when its deadline falls within a season (the calendar's). */
export const DUE_WITHIN_TICKS = BALANCE.TICKS_PER_YEAR / 4;
const TICKS_PER_DAY = BALANCE.TICKS_PER_YEAR / 360;
/** The UI-part ids the promise marks use (one per state, mutually exclusive). */
export const PROMISE_MARK: Readonly<Record<PromiseState, string>> = {
  open: "lord.ledger.promise_active", due: "lord.ledger.promise_due", kept: "lord.ledger.promise_kept", broken: "lord.ledger.promise_broken",
};

export type PromiseRow = Readonly<{
  id: string; state: PromiseState; mark: string; label: string; term: string; amount: string | null; party: string;
  /** The deadline line with its marker (open promises with a deadline only), or null. */
  deadline: string | null; dueToday: boolean;
  settled: string | null; witnesses: string | null; stake: string;
  /** A debt instalment's share (FIX-12 / FIX-13: a debt repaid by the year), or null. */
  debt: string | null;
  /** The lord's own open promise: the keep button's state; null for the counterpart's word or a settled one. */
  keep: Shut | null; focused: boolean;
}>;
export type TermRow = Readonly<{ id: string; kind: string; what: string; amount: string; years: string; end: string; running: boolean }>;
export type LedgerView = Readonly<{
  treasury: string;
  promises: Readonly<{ open: readonly PromiseRow[]; past: readonly PromiseRow[]; none: boolean }>;
  terms: readonly TermRow[];
  claims: readonly ClaimRow[];
  suits: readonly SuitRow[];
  neighbourSuits: readonly SuitRow[];
  /** DTR-23: the forcible entries forewarned and the last that ended; null: neither. */
  threats: ThreatsView | null;
}>;

// --- promises ------------------------------------------------------------------------------------------------------------

export function promiseState(state: GameState, record: PromiseRecord): PromiseState {
  if (record.status !== "open") return record.status;
  return record.deadline - state.tick <= DUE_WITHIN_TICKS ? "due" : "open";
}

function promiseRow(state: GameState, record: PromiseRecord, all: readonly PromiseRecord[], focus: string | null): PromiseRow {
  const status = promiseState(state, record);
  const lords = record.promisor === LORD;
  const open = record.status === "open";
  const term = COPY.terms[record.term];
  const amount = record.amount === undefined || record.amount <= 0 ? null : moneyShort(record.amount);
  const days = Math.floor(record.deadline / TICKS_PER_DAY) - Math.floor(state.tick / TICKS_PER_DAY);
  const debt = record.term === "debt_after_inheritance" || record.term === "debt_assumption"
    ? (() => {
      const shares = all.filter(entry => entry.negotiationId === record.negotiationId && entry.term === record.term && entry.promisor === record.promisor)
        .sort((a, b) => a.deadline - b.deadline);
      return COPY.debtShare(shares.findIndex(entry => entry.id === record.id) + 1, shares.length);
    })() : null;
  return {
    id: record.id, state: status, mark: PROMISE_MARK[status], label: COPY.states[status], term, amount,
    party: lords ? COPY.byLord(holderName(state, record.promisee)) : COPY.toLord(holderName(state, record.promisor)),
    deadline: open && Number.isFinite(record.deadline) ? COPY.deadline(dateLabel(state, record.deadline),
      days <= 0 ? COPY.dueToday : calendarArrivalLabel(state.tick, record.deadline, scenarioOf(state).startYear)) : null,
    dueToday: open && days <= 0,
    settled: open ? null : COPY.settled(COPY.states[status], dateLabel(state, record.settledTick ?? record.deadline)),
    witnesses: record.witnesses.length === 0 ? null : COPY.witnesses(record.witnesses.map(id => holderName(state, id)).join(", ")),
    stake: COPY.stake(record.stake.trust, record.stake.relation), debt,
    keep: lords && open ? shut(would(state, { type: "keep_promise", promiseId: record.id })) : null,
    focused: focus === record.id,
  };
}

// --- registry terms ------------------------------------------------------------------------------------------------------

function termRow(state: GameState, term: RegistryTerm): TermRow {
  const running = term.status === "running";
  return {
    id: term.id, kind: COPY.termKinds[term.kind], what: COPY.termWhat[term.what] ?? term.what,
    amount: term.kind === "remission" && term.what === "market_dues" ? COPY.termRemission(term.amountPerYear) : COPY.termPerYear(moneyShort(term.amountPerYear)),
    years: COPY.termYears(term.settledYears, term.years),
    end: running ? COPY.termLeft(dateLabel(state, term.endTick), durationLabel(term.endTick - state.tick)) : COPY.termEnded(dateLabel(state, term.endTick)),
    running,
  };
}

// --- the view ------------------------------------------------------------------------------------------------------------

/** The screen's rows (null outside lord mode). `focus`: a promise, suit or claim id the screen was opened on. */
export function ledgerView(state: GameState, focus: string | null): LedgerView | null {
  if (!lordMode(state)) return null;
  const promises = diplomacyOf(state).promises;
  const rows = promises.map(record => promiseRow(state, record, promises, focus));
  // Open ones by deadline (the nearest first); settled ones newest first.
  const open = rows.filter(row => row.state === "open" || row.state === "due")
    .sort((a, b) => promises.find(entry => entry.id === a.id)!.deadline - promises.find(entry => entry.id === b.id)!.deadline);
  const settledAt = (row: PromiseRow) => { const record = promises.find(entry => entry.id === row.id)!; return record.settledTick ?? record.deadline; };
  const past = rows.filter(row => row.state === "kept" || row.state === "broken").sort((a, b) => settledAt(b) - settledAt(a));
  const { claims, suits, neighbourSuits } = suitsView(state, focus);
  return {
    treasury: COPY.treasury(moneyFull(treasuryBalance(state))),
    promises: { open, past, none: rows.length === 0 },
    terms: registryOf(state).terms.map(term => termRow(state, term)),
    claims, suits, neighbourSuits, threats: threatsView(state, focus),
  };
}

import { BALANCE } from "../../../content/balanceConfig";
import { factionDisplayName } from "../../../content/factionCopy.ko";
import { GENTRY_NAMES_KO } from "../../../content/gentryNames";
import { SCENARIO_COPY } from "../../../content/scenario/scenarioCopy.ko";
import type { PromiseRecord } from "../../../engine/diplomacy.types";
import type { GameState } from "../../../engine/engine.types";
import { estatePerson, estatesOf, LORD } from "../../../engine/estates";
import type { Claim, Estate, Evidence, Suit, SuitStage } from "../../../engine/estates.types";
import { fileSuitRefusal, suitHearing } from "../../../engine/estateSuits";
import { faction } from "../../../engine/factions";
import { diplomacyOf } from "../../../engine/negotiation";
import { registryOf } from "../../../engine/registry";
import type { RegistryTerm } from "../../../engine/registry.types";
import { calendar, scenarioOf } from "../../../engine/scenarioState";
import { lordMode } from "../../../engine/townAgency";
import { treasuryBalance } from "../../../ledger/ledger";
import { gameReducer } from "../../../state/gameStore";
import type { GameAction } from "../../../state/gameStore.types";
import { calendarArrivalLabel } from "../../calendarArrival";
import { durationLabel } from "../../gameTimeCopy.ko";
import { moneyFull, moneyShort } from "../../money.ko";
import { lordPersonRow } from "../screen/lordPortrait";
import { claimOutlook } from "./claimOutlook";
import { LORD_LEDGER_COPY as COPY, type PromiseState } from "./ledgerCopy.ko";

// LM-R2 (ledger area): the lord screen's promises and suits as pure rows read from the engine's read models —
// `diplomacyOf(state).promises` (NG-6), `registryOf(state).terms` (ER-7), the estates' claims and suits with
// `fileSuitRefusal` and `suitHearing` (ES-7) and the neighbours' suits against the lord (ER-21, display only).
// No engine rule is copied here: whether a press would do anything is the game's own reducer tried on the current state
// (`would`: the same command the button sends; a refused command hands back the same state object). Where the engine
// exposes no reason (keepPromiseRefusal, suitActions: filed, docs/requests/engine-lmr2-seen-and-reads.md) the button is
// shut with a neutral line, never a guessed cause; costs and weights not yet given are not shown (suitActions). PLAY-2:
// a claim's filing cost and the hearing's two sides are the filing tried on the state (claimOutlook).

/** NG-6 has no "due" status: an open promise is shown due when its deadline falls within a season (the calendar's). */
export const DUE_WITHIN_TICKS = BALANCE.TICKS_PER_YEAR / 4;
const TICKS_PER_DAY = BALANCE.TICKS_PER_YEAR / 360;
const STAGE_ORDER: Readonly<Record<SuitStage, number>> = { filed: 0, evidence: 1, patronage: 2, hearing: 3, judged: 4, enforcing: 5, closed: 6 };
/** The suit track's stages in order (the engine's SuitStage, ES-7). */
export const SUIT_TRACK: readonly SuitStage[] = (Object.keys(STAGE_ORDER) as SuitStage[]).sort((a, b) => STAGE_ORDER[a] - STAGE_ORDER[b]);
const EVIDENCE_ORDER: Readonly<Record<Evidence["kind"], true>> = { charter: true, deed: true, court_roll: true, witnesses: true, possession_years: true };
/** The evidence kinds a suit can carry (the engine's Evidence["kind"]). */
export const EVIDENCE_KINDS: readonly Evidence["kind"][] = Object.keys(EVIDENCE_ORDER) as Evidence["kind"][];
/** The UI-part ids the promise marks use (one per state, mutually exclusive). */
export const PROMISE_MARK: Readonly<Record<PromiseState, string>> = {
  open: "lord.ledger.promise_active", due: "lord.ledger.promise_due", kept: "lord.ledger.promise_kept", broken: "lord.ledger.promise_broken",
};

/** Whether the game would take this command now: the reducer's answer on the current state (a refusal is the same object). */
export const would = (state: GameState, action: GameAction): boolean => gameReducer(state, action) !== state;

export type Shut = Readonly<{ enabled: boolean; reason: string | null }>;
const shut = (enabled: boolean): Shut => ({ enabled, reason: enabled ? null : COPY.keepShut });

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
/** PLAY-2: `cost` and `hearing` from the filing tried on the state (claimOutlook), null when it would be refused. */
export type ClaimRow = Readonly<{ id: string; what: string; line: string; refusal: string | null; cost: string | null; hearing: string | null; focused: boolean }>;
export type TrackStep = Readonly<{ stage: SuitStage; label: string; at: "done" | "now" | "ahead" }>;
export type EvidenceRow = Readonly<{ kind: Evidence["kind"]; label: string; given: string | null; bring: Shut | null }>;
export type PatronRow = Readonly<{ factionId: string; name: string; relation: string }>;
export type SuitRow = Readonly<{
  id: string; claimId: string; what: string; party: string; stage: SuitStage; since: string; track: readonly TrackStep[];
  costs: string; hearing: string | null; verdict: string | null;
  /** Evidence: every kind with what was given (its weight, from the claim) or whether it can be brought now; null once judged. */
  evidence: readonly EvidenceRow[] | null;
  /** The chosen patron, or the factions the engine would take now (patronage stage), or null outside it. */
  patron: Readonly<{ chosen: string | null; options: readonly PatronRow[] }> | null;
  enforce: Readonly<{ lines: readonly string[]; button: Shut | null }> | null;
  focused: boolean; neighbour: boolean;
}>;
export type LedgerView = Readonly<{
  treasury: string;
  promises: Readonly<{ open: readonly PromiseRow[]; past: readonly PromiseRow[]; none: boolean }>;
  terms: readonly TermRow[];
  claims: readonly ClaimRow[];
  suits: readonly SuitRow[];
  neighbourSuits: readonly SuitRow[];
}>;

// --- words ---------------------------------------------------------------------------------------------------------------

export function dateLabel(state: GameState, tick: number): string {
  const date = calendar(tick, scenarioOf(state).startYear);
  return COPY.date(date.year, SCENARIO_COPY.seasons[date.season], date.dayOfYear - date.season * 90);
}

/** A neighbour's name in Korean (the engine keeps the Latin one): "de Heronel" → "드 헤로넬". */
const houseWord = (name: string): string => GENTRY_NAMES_KO[name] ?? name;

function estateWord(estate: Estate | undefined, estateId: string): string {
  if (estate === undefined) return estateId;
  return estate.offMap ? COPY.estateName(houseWord(estate.name)) : COPY.homeEstate;
}

/** A holder's name (ES-1 HolderId): the lord, a faction, a person, a neighbour estate's house. */
export function holderName(state: GameState, holder: string): string {
  if (holder.startsWith("person:")) {
    const person = estatePerson(state, holder.slice("person:".length));
    return person === undefined ? COPY.oldKin : lordPersonRow(state, person).name;
  }
  if (holder.startsWith("estate:")) {
    const estate = estatesOf(state).estates.find(entry => entry.id === holder.slice("estate:".length));
    return COPY.houseOf(houseWord(estate?.house?.name ?? estate?.name ?? holder));
  }
  const known = COPY.holders[holder];
  if (known !== undefined) return known;
  const view = faction(state, holder as Parameters<typeof faction>[1]);
  return view === undefined ? holder : factionDisplayName(view.id, view.name);
}

/** What a claim or suit is on: the estate, and the piece when it is one. */
function onWhat(state: GameState, estateId: string, pieceId: string | undefined): string {
  const estate = estatesOf(state).estates.find(entry => entry.id === estateId);
  const piece = pieceId === undefined ? undefined : estate?.pieces.find(entry => entry.id === pieceId);
  const pieceWord = pieceId === undefined ? COPY.wholeEstate : piece === undefined ? pieceId : COPY.pieces[piece.kind];
  return COPY.estatePiece(estateWord(estate, estateId), pieceWord);
}

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

// --- suits ---------------------------------------------------------------------------------------------------------------

function track(stage: SuitStage): readonly TrackStep[] {
  const now = SUIT_TRACK.indexOf(stage);
  return SUIT_TRACK.map((entry, index) => ({ stage: entry, label: COPY.stages[entry], at: index < now ? "done" : index === now ? "now" : "ahead" }));
}

function suitRow(state: GameState, suit: Suit, claim: Claim | undefined, focus: string | null): SuitRow {
  const lords = suit.plaintiff === LORD;
  const judged = suit.verdict !== undefined;
  const sides = judged ? null : suitHearing(state, suit.id);
  const factions = state.factions?.factions ?? [];
  const evidence = !lords || judged ? null : EVIDENCE_KINDS.map(kind => {
    const given = claim?.evidence.find(entry => entry.kind === kind);
    return { kind, label: COPY.evidence[kind], given: given === undefined ? null : COPY.evidenceGiven(given.weight),
      bring: given === undefined ? shut(would(state, { type: "add_suit_evidence", suitId: suit.id, evidence: kind })) : null };
  });
  const options = !lords || suit.patron !== undefined || suit.stage !== "patronage" ? [] : factions
    .filter(entry => would(state, { type: "seek_suit_patron", suitId: suit.id, factionId: entry.id }))
    .map(entry => ({ factionId: entry.id, name: holderName(state, entry.id), relation: COPY.patronRelation(entry.relation) }));
  const patron = suit.patron !== undefined ? { chosen: COPY.patronChosen(holderName(state, suit.patron), suit.patronSupport), options: [] }
    : lords && suit.stage === "patronage" ? { chosen: null, options } : null;
  const enforcing = suit.stage === "enforcing" || suit.enforcements > 0;
  const enforce = !enforcing ? null : {
    lines: [...(suit.hold === undefined ? [] : [COPY.hold(suit.hold)]), COPY.patronForce(suit.patronSupport), COPY.attempts(suit.enforcements),
      ...(suit.enforced === true ? [COPY.enforced] : [])],
    button: lords && suit.stage === "enforcing" ? shut(would(state, { type: "enforce_possession", suitId: suit.id })) : null,
  };
  return {
    id: suit.id, claimId: suit.claimId, what: onWhat(state, suit.estateId, suit.pieceId),
    party: lords ? COPY.against(holderName(state, suit.defendant)) : COPY.byNeighbour(holderName(state, suit.plaintiff)),
    stage: suit.stage, since: COPY.stageSince(COPY.stages[suit.stage], dateLabel(state, suit.stageSince)), track: track(suit.stage),
    costs: COPY.costs(moneyShort(suit.costs)),
    hearing: sides === null ? null : lords ? COPY.hearing(sides.plaintiff, sides.defence) : COPY.hearingNeighbour(sides.plaintiff, sides.defence),
    verdict: suit.verdict === undefined ? null : COPY.verdict[suit.verdict],
    evidence, patron, enforce, neighbour: !lords,
    focused: focus !== null && (focus === suit.id || focus === suit.claimId),
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
  const estates = estatesOf(state);
  const claims = estates.claims.filter(claim => claim.claimant === LORD && claim.status === "open").map(claim => {
    const refusal = fileSuitRefusal(state, claim.id);
    const outlook = refusal === null ? claimOutlook(state, claim.id) : null;
    return { id: claim.id, what: onWhat(state, claim.estateId, claim.pieceId), line: COPY.claimLine(COPY.basis[claim.basis], claim.strength),
      refusal: refusal === null ? null : COPY.refusals[refusal], cost: outlook === null ? null : moneyShort(outlook.cost),
      hearing: outlook === null || outlook.sides === null ? null : COPY.hearingIfFiled(outlook.sides.plaintiff, outlook.sides.defence), focused: focus === claim.id };
  });
  const claimOf = (suit: Suit) => estates.claims.find(claim => claim.id === suit.claimId);
  // The lord's suits under way first (then the closed, newest first); the neighbours' against him apart.
  const order = (a: Suit, b: Suit) => Number(a.stage === "closed") - Number(b.stage === "closed") || b.stageSince - a.stageSince;
  const suits = estates.suits.filter(suit => suit.plaintiff === LORD).slice().sort(order).map(suit => suitRow(state, suit, claimOf(suit), focus));
  const neighbourSuits = estates.suits.filter(suit => suit.plaintiff !== LORD && suit.defendant === LORD).slice().sort(order)
    .map(suit => suitRow(state, suit, claimOf(suit), focus));
  return {
    treasury: COPY.treasury(moneyFull(treasuryBalance(state))),
    promises: { open, past, none: rows.length === 0 },
    terms: registryOf(state).terms.map(term => termRow(state, term)),
    claims, suits, neighbourSuits,
  };
}

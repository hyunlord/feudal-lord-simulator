import type { GameState } from "../../../engine/engine.types";
import type { EntryThreat, Evidence, Suit } from "../../../engine/estates.types";
import type { HistoryRecord } from "../../../engine/history.types";
import { entryDefenceCosts, entryThreats, suitDefenceActions } from "../../../engine/suitDefence";
import { calendarArrivalLabel } from "../../calendarArrival";
import { recordSentence } from "../../legacy/chapterRecords";
import { moneyShort } from "../../money.ko";
import { scenarioOf } from "../../../engine/scenarioState";
import { LORD_LEDGER_COPY as LEDGER } from "./ledgerCopy.ko";
import { dateLabel, holderName, onWhat, shut, would, type Shut } from "./ledgerWords";
import { SUIT_DEFENCE_COPY as COPY } from "./suitDefenceCopy.ko";

// SUIT-THREAD (DTR-23) the lord sued, as the ledger's rows: his defence in a house's suit against him — every number and
// refusal from the engine's `suitDefenceActions` (each evidence kind's cost and weight, the factions as patrons, the
// final concord's price, the hold's cost and boost) — and the forcible entries forewarned (`entryThreats`,
// `entryDefenceCosts`) with the engine's own sentences for them (the history's `estate.entry_*` records). The guard
// and the gift have no refusal in the engine's reads: their buttons are the reducer tried on the state (`would`), shut
// with the neutral line.

/** A kind of evidence for the lord's side: given (its weight) or the button with its cost and weight, shut with why. */
export type DefenceEvidenceRow = Readonly<{ kind: Evidence["kind"]; label: string; note: string; given: string | null; bring: Shut | null }>;
export type DefenceRow = Readonly<{
  evidence: readonly DefenceEvidenceRow[];
  /** One sentence instead of the buttons when none can be brought now (the given ones stay listed). */
  evidenceShut: string | null;
  patron: Readonly<{ chosen: string | null; options: readonly Readonly<{ factionId: string; name: string; note: string; support: number }>[]; shut: string | null }>;
  concord: Readonly<{ price: string; pay: Shut }>;
  hold: Readonly<{ line: string; cost: string; button: Shut }>;
  /** Whether evidence or a patron can still raise his side (the hearing line says so). */
  open: boolean;
}>;

/**
 * A suit's evidence kinds as the engine's actions give them (`suitActions` for the lord's suits, `suitDefenceActions` for
 * his defence): given (the weight given) or the button with its cost and weight, shut with the refusal's sentence; and one
 * sentence instead of the buttons when none can be brought now (its first reason, the stage before the treasury).
 */
export function evidenceRows(actions: readonly Readonly<{ kind: Evidence["kind"]; cost: number; weight: number; refusal: keyof typeof COPY.evidenceRefusals | null }>[],
  given: readonly Evidence[]): Readonly<{ rows: readonly DefenceEvidenceRow[]; shut: string | null }> {
  const rows = actions.map((entry): DefenceEvidenceRow => {
    const brought = given.find(item => item.kind === entry.kind);
    const note = LEDGER.evidenceNote(entry.cost > 0 ? moneyShort(entry.cost) : null, entry.weight);
    return { kind: entry.kind, label: LEDGER.evidence[entry.kind], note, given: brought === undefined ? null : LEDGER.evidenceGiven(brought.weight),
      bring: brought !== undefined || entry.refusal === "given" ? null : shut(entry.refusal === null, entry.refusal === null ? undefined : COPY.evidenceRefusals[entry.refusal]) };
  });
  const left = actions.filter(entry => entry.refusal !== "given" && !given.some(item => item.kind === entry.kind));
  const reason = left.find(entry => entry.refusal === "stage")?.refusal ?? left.find(entry => entry.refusal !== null)?.refusal ?? null;
  return { rows, shut: left.length === 0 || left.some(entry => entry.refusal === null) || reason === null ? null : COPY.evidenceRefusals[reason] };
}

/** The defence row for a suit against the lord while it stands; null when the engine gives none (closed, not his). */
export function defenceRow(state: GameState, suit: Suit): DefenceRow | null {
  const actions = suitDefenceActions(state, suit.id);
  if (actions === null) return null;
  const { rows: evidence, shut: evidenceShut } = evidenceRows(actions.evidence, suit.defenceEvidence ?? []);
  const options = actions.patrons.filter(entry => entry.refusal === null)
    .map(entry => ({ factionId: entry.factionId, name: holderName(state, entry.factionId), note: COPY.patronSupport(entry.support), support: entry.support }));
  const chosen = suit.defencePatron === undefined ? null : COPY.patronChosen(holderName(state, suit.defencePatron), suit.defenceSupport ?? 0);
  const refused = actions.patrons.find(entry => entry.refusal === "stage") ?? actions.patrons.find(entry => entry.refusal !== null);
  const patronShut = chosen !== null || options.length > 0 || refused?.refusal == null ? null : COPY.patronRefusals[refused.refusal];
  const concordShut = actions.concord.refusal === null ? undefined : COPY.concordRefusals[actions.concord.refusal];
  return {
    evidence, evidenceShut, patron: { chosen, options, shut: patronShut },
    concord: { price: moneyShort(actions.concord.price), pay: shut(actions.concord.refusal === null, concordShut) },
    hold: { line: COPY.holdLine(actions.hold.hold, actions.hold.boost), cost: moneyShort(actions.hold.cost),
      button: shut(actions.hold.refusal === null, actions.hold.refusal === null ? undefined : COPY.holdRefusals[actions.hold.refusal]) },
    open: evidence.some(entry => entry.bring?.enabled === true) || options.length > 0,
  };
}

// --- forcible entries ----------------------------------------------------------------------------------------------------

export type ThreatRow = Readonly<{
  id: string; title: string; when: string;
  /** The engine's sentence for the forewarning (its `estate.entry_threatened` record), or null when none is kept. */
  sentence: string | null;
  house: string; what: string; guarded: boolean;
  guard: Readonly<{ cost: string; button: Shut }> | null;
  appease: Readonly<{ cost: string; button: Shut }>;
  focused: boolean;
}>;
export type ThreatsView = Readonly<{ threats: readonly ThreatRow[]; past: readonly Readonly<{ id: string; line: string }>[] }>;

const ENTRY_ENDS: ReadonlySet<string> = new Set(["estate.entry_repelled", "estate.entry_called_off", "estate.entry_forced"]);
/** How many past entries the section keeps (the newest). */
const PAST_SHOWN = 3;

function threatRow(state: GameState, threat: EntryThreat, records: readonly HistoryRecord[], focus: string | null): ThreatRow {
  const costs = entryDefenceCosts(state, threat);
  const house = holderName(state, threat.house);
  const what = onWhat(state, threat.estateId, threat.pieceId);
  const record = records.find(entry => entry.template === "estate.entry_threatened" && entry.params?.threat === threat.id);
  const guarded = threat.guarded === true;
  return {
    id: threat.id, title: what, house, what, guarded,
    when: COPY.threatWhen(house, dateLabel(state, threat.tick), dateLabel(state, threat.due), calendarArrivalLabel(state.tick, threat.due, scenarioOf(state).startYear)),
    sentence: record === undefined ? null : recordSentence(state, record),
    guard: guarded ? null : { cost: moneyShort(costs.guard), button: shut(would(state, { type: "guard_possession", threatId: threat.id })) },
    appease: { cost: moneyShort(costs.appease), button: shut(would(state, { type: "appease_neighbour", threatId: threat.id })) },
    focused: focus === threat.id,
  };
}

/** The entries forewarned (the soonest first) and the last few that ended, in the engine's words; null: neither. */
export function threatsView(state: GameState, focus: string | null): ThreatsView | null {
  const records = state.history?.records ?? [];
  const threats = [...entryThreats(state)].sort((a, b) => a.due - b.due || a.id.localeCompare(b.id)).map(threat => threatRow(state, threat, records, focus));
  const past = records.filter(record => ENTRY_ENDS.has(record.template)).slice(-PAST_SHOWN).reverse()
    .map(record => ({ id: record.id, line: LEDGER.dated(recordSentence(state, record), dateLabel(state, record.tick)) }));
  if (threats.length === 0 && past.length === 0) return null;
  return { threats, past };
}

/** The engine's sentence for a suit's concord (its `estate.suit_settled` record), or the short line, with its date. */
export function settledLine(state: GameState, suit: Suit): string | null {
  if (suit.settled === undefined) return null;
  const record = (state.history?.records ?? []).find(entry => entry.template === "estate.suit_settled" && entry.params?.suit === suit.id);
  return LEDGER.dated(record === undefined ? LEDGER.concordEnded[suit.settled] : recordSentence(state, record), dateLabel(state, suit.stageSince));
}

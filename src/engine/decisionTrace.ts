/**
 * DEC-TRACE §2 (docs/design/dec-trace.md, A4·A5·A6, P-C1·P-C2·P-C3): the thread of consequence, lord mode only.
 *
 * - A decision is the lord's command that changed the state (`traceCommand`; its history record is the card's answer,
 *   `recordDecision`), the steward's answer by the lord's standing policy, or a matter left to lapse (`advanceTrace`).
 *   Its id is its history record's; it is kept with what it touched (its targets, from the state before and after).
 * - A faction's memory of a relation change is tied to the decision whose words it carries (the same reason key).
 * - What later happens to a target within three years is written in the history (`consequence`, `faction.act`) with the
 *   decisions behind it in `because` — the main one first, `part` when it had other causes or other decisions a share.
 * The thread never changes the simulation; the faction acts (`factionActs.ts`) read the memories' decisions.
 */
import { MARKET_CHARTER_PETITION_ID } from "../content/chapterConfig";
import { BALANCE } from "../content/balanceConfig";
import { GRANT_PIECE, HOME_ESTATE_ID, PIECE_INCOME_CATEGORIES } from "../content/estateConfig";
import { GUILD_CHARTER_PETITION_ID } from "../content/reorganisationConfig";
import { COMMAND_WEIGHT, type DecisionWeight } from "../content/stewardPolicyConfig";
import type { GameState } from "./engine.types";
import type { FactionMemory } from "./faction.types";
import { appendHistoryRecords, type HistoryDraft } from "./history";
import type { ActorRef, HistoryBecause } from "./history.types";
import type { LedgerEntry } from "../ledger/ledger.types";
import type { ConsequenceKey, TracedDecision, TracedDecisionKind, TraceState } from "./decisionTrace.types";
import { CRISIS_RESERVE_DAYS } from "../content/crisisConfig";
import { FAMINE_FLOWS, PETITION_FLOWS, TARGET_FLOWS } from "../content/decisionFlowConfig";
import { preparedness } from "./crisisReads";
import { stateCalendar } from "./scenarioState";
import { FACTION_OF_ACTOR } from "./townAgency";
import { POSSESSION_RENT_DETAIL } from "./possessionRent";

const YEAR = BALANCE.TICKS_PER_YEAR;
/** A decision's targets stay live this long (the user's gate: a consequence within three years). */
export const TRACE_LIVE_TICKS = 3 * YEAR;
/** P-T6: what the thread keeps of its decisions (their records stay in the history). */
const TRACE_KEPT_TICKS = 10 * YEAR;
/** A faction's memory is tied to a decision of the same words within this many ticks (the history writes it a tick on). */
const MEMORY_LINK_TICKS = 4;
/** An off-map estate's mood counts as moved when it crosses a band this wide. */
const ESTATE_MOOD_BAND = 20;
/** At most this many decisions named behind one record (the render request's four). */
const BECAUSE_MAX = 4;
/** The kinds of building a chapter petition's acceptance opens (its consequence is the town's project of that kind). */
const PETITION_OPENS: Readonly<Record<string, readonly string[]>> = { [MARKET_CHARTER_PETITION_ID]: ["market"] };
const TOWN: ActorRef = { type: "town", id: "town" };

export function traceOf(state: Pick<GameState, "trace">): TraceState {
  return state.trace ?? { decisions: [], acts: [] };
}

const lastRecordId = (state: GameState) => state.history?.records.at(-1)?.id;

// --- targets ------------------------------------------------------------------------------------------------------------

/** What a change touched: the things later consequences are looked for on. */
export function changedTargets(before: GameState, after: GameState): string[] {
  const targets = new Set<string>();
  const subsidies = (state: GameState) => new Map((state.agency?.subsidies ?? []).map(subsidy => [subsidy.kind, subsidy.amount] as const));
  const was = subsidies(before), now = subsidies(after);
  for (const kind of new Set([...was.keys(), ...now.keys()])) if (was.get(kind) !== now.get(kind)) targets.add(`subsidy:${kind}`);
  if (before.agency?.policy !== after.agency?.policy) targets.add("policy");
  if (before.agency?.duesPermille !== after.agency?.duesPermille) targets.add("dues");
  if ((before.timberOrder ?? 0) !== (after.timberOrder ?? 0)) targets.add("timber");
  const suits = new Map((before.estates?.suits ?? []).map(suit => [suit.id, suit] as const));
  for (const suit of after.estates?.suits ?? []) {
    if (suits.get(suit.id) === suit) continue;
    targets.add(`suit:${suit.id}`);
    // DTR-11, SUIT-THREAD (DTR-20): a judgment enforced — the possession's first rent to the lord carries it.
    if (suit.enforced === true && suits.get(suit.id)?.enforced !== true) targets.add(`rent:${suit.estateId}|${suit.pieceId ?? suit.estateId}`);
  }
  const claims = new Map((before.estates?.claims ?? []).map(claim => [claim.id, claim] as const));
  for (const claim of after.estates?.claims ?? []) {
    if (claims.get(claim.id) === claim) continue;
    const suit = (after.estates?.suits ?? []).find(entry => entry.claimId === claim.id);
    targets.add(suit === undefined ? `claim:${claim.id}` : `suit:${suit.id}`);
  }
  const negotiations = new Map((before.diplomacy?.negotiations ?? []).map(entry => [entry.id, entry] as const));
  for (const entry of after.diplomacy?.negotiations ?? []) if (negotiations.get(entry.id) !== entry) targets.add(`negotiation:${entry.id}`);
  const promises = new Map((before.diplomacy?.promises ?? []).map(entry => [entry.id, entry] as const));
  for (const entry of after.diplomacy?.promises ?? []) {
    if (promises.get(entry.id) === entry) continue;
    // A promise carries on its negotiation's thread (the marriage, its heir, the alliance).
    targets.add(`promise:${entry.id}`);
    targets.add(`negotiation:${entry.negotiationId}`);
  }
  const oversight = new Map((before.stewardship?.oversight ?? []).map(entry => [entry.estateId, entry] as const));
  for (const entry of after.stewardship?.oversight ?? []) {
    const old = oversight.get(entry.estateId);
    if (old === undefined || old.mode !== entry.mode || old.stewardId !== entry.stewardId || old.auditMode !== entry.auditMode) targets.add(`estate:${entry.estateId}`);
  }
  const audits = new Map((before.stewardship?.audits ?? []).map(entry => [entry.id, entry] as const));
  for (const entry of after.stewardship?.audits ?? []) if (audits.get(entry.id) !== undefined && audits.get(entry.id) !== entry) targets.add(`estate:${entry.estateId}`);
  if ((after.war?.taxSeasonsLeft ?? 0) > (before.war?.taxSeasonsLeft ?? 0)) targets.add("war_tax");
  // A chapter petition that opens a kind of building: the town's first such project follows from it.
  for (const petition of after.politics?.petitions ?? []) {
    const old = before.politics?.petitions.find(entry => entry.id === petition.id);
    if (petition.response === "accept" && old?.response !== "accept") for (const kind of PETITION_OPENS[petition.defId] ?? []) targets.add(`build:${kind}`);
    // DTR-11: the ledger lines the answer sets going in the seasons after (the wool in kind, the loan repaid, the wages).
    if (petition.response !== undefined && petition.response !== "expired" && old?.response !== petition.response) {
      for (const category of PETITION_FLOWS[petition.defId]?.[petition.response] ?? []) targets.add(`flow:${category}`);
    }
  }
  // A right granted: its income (its piece's ledger categories) is what follows from it.
  const rights = new Set((before.politics?.rights ?? []).map(right => right.id));
  for (const right of after.politics?.rights ?? []) {
    const id = right.id.split("@")[0]!;
    if (!rights.has(right.id) && GRANT_PIECE[id] !== undefined) targets.add(`right:${id}`);
  }
  // A crisis answered (the famine's response): its outcome follows from it.
  const events = new Map((before.events?.records ?? []).map(record => [record.id, record] as const));
  for (const record of after.events?.records ?? []) {
    if (record.response === undefined || events.get(record.id)?.response !== undefined) continue;
    targets.add(`event:${record.id}`);
    for (const category of FAMINE_FLOWS[record.response.choice] ?? []) targets.add(`flow:${category}`);
  }
  const guild = (state: GameState) => state.politics?.petitions.find(petition => petition.defId === GUILD_CHARTER_PETITION_ID)?.response;
  if (guild(before) !== guild(after) && guild(after) !== undefined) targets.add("guild");
  return [...targets].sort();
}

// --- decisions ------------------------------------------------------------------------------------------------------------

function addDecision(state: GameState, decision: TracedDecision): GameState {
  const trace = traceOf(state);
  return { ...state, trace: { ...trace, decisions: [...trace.decisions, decision] } };
}

/** The decision record the command just wrote in the history (`recordDecision`). */
function newHistoryDecision(before: GameState, after: GameState): string | undefined {
  const records = after.history?.records ?? [];
  const known = before.history?.records.length ?? 0;
  for (let index = records.length - 1; index >= known; index -= 1) if (records[index]!.kind === "decision") return records[index]!.id;
  return undefined;
}

type Action = { readonly type: string } & Readonly<Record<string, unknown>>;

const COMMAND_KIND: Readonly<Record<string, TracedDecisionKind>> = {
  answer_registry_offer: "registry", answer_estate_petition: "estate_petition", petition_response: "chapter_petition", famine_response: "famine",
  file_suit: "suit", add_suit_evidence: "suit", seek_suit_patron: "suit", enforce_possession: "suit",
  propose_marriage: "marriage", answer_counter: "marriage", keep_promise: "marriage", answer_will_change: "marriage",
  set_estate_oversight: "oversight", set_audit_mode: "oversight", set_exception_rules: "oversight", answer_audit: "audit",
  set_estate_policy: "policy", set_project_subsidy: "subsidy", set_market_dues: "dues", order_timber: "timber", set_standing_policy: "standing_policy",
};

/** The matters a decision's thread follows as one (a suit, a marriage, an estate's oversight). */
const MATTER = /^(suit|negotiation|estate):/;

/** A lord's command that carries on a matter he decided within the thread's years joins that decision (its targets grow), or null. */
function joinMatter(state: GameState, kind: TracedDecisionKind, targets: readonly string[], source: string): GameState | null {
  const trace = traceOf(state);
  const matters = targets.filter(target => MATTER.test(target));
  const sameMoment = kind === "oversight";
  for (let index = trace.decisions.length - 1; index >= 0; index -= 1) {
    const earlier = trace.decisions[index]!;
    if (state.tick - earlier.tick > 2 * TRACE_LIVE_TICKS) break;
    if (state.tick - (earlier.lastTick ?? earlier.tick) > TRACE_LIVE_TICKS) continue;
    if (earlier.by !== "lord" || earlier.kind !== kind || earlier.lapsed === true) continue;
    const shared = matters.some(target => earlier.targets.includes(target));
    if (!shared && !(sameMoment && earlier.tick === state.tick)) continue;
    const decisions = [...trace.decisions];
    decisions[index] = { ...earlier, targets: [...new Set([...earlier.targets, ...targets])].sort(),
      also: [...new Set([...(earlier.also ?? []), source])].filter(key => key !== earlier.source), lastTick: state.tick };
    return { ...state, trace: { ...trace, decisions } };
  }
  return null;
}

/**
 * DEC-TRACE §2: a command of the lord's that changed the state, kept as a decision with what it touched. Its source is
 * the same key the factions' memories carry for it (`registry:<entry>:<choice>`, `manor_petition:<kind>:<answer>`,
 * `petition:<def>:<answer>`, `famine:<choice>`, `steward_punished:<audit>`, `set_market_dues:<permille>`, …), so their
 * changes are tied to it. Its id is its history record's (`recordDecision` wrote it).
 */
export function traceCommand(before: GameState, after: GameState, action: Action): GameState {
  if (after === before || after.agency === undefined) return after;
  const kind = COMMAND_KIND[action.type];
  if (kind === undefined) return after;
  let source = `${action.type}`;
  let weights: DecisionWeight[] = COMMAND_WEIGHT[action.type] === undefined ? [] : [COMMAND_WEIGHT[action.type]!];
  let decisionKind: TracedDecisionKind = kind;
  if (action.type === "answer_registry_offer") {
    const occurrence = after.registry?.occurrences.find(entry => entry.id === action.occurrenceId);
    // An answer the registry found invalid (its targets gone) decided nothing.
    if (occurrence?.status !== "answered") return after;
    source = `registry:${occurrence.entryId}:${String(action.choiceId)}`;
    weights = [...(occurrence.weights ?? [])];
  } else if (action.type === "answer_estate_petition") {
    const petition = after.stewardship?.petitions.find(entry => entry.id === action.petitionId);
    const manor = petition?.estateId === HOME_ESTATE_ID;
    decisionKind = manor ? "manor_petition" : "estate_petition";
    source = manor ? `manor_petition:${petition?.kind}:${petition?.status}` : `estate_petition:${petition?.estateId}:${petition?.kind}:${petition?.status}`;
    weights = petition?.escalated === "amount" ? ["large_sum"] : petition?.escalated === "rights" ? ["rights"] : [];
  } else if (action.type === "petition_response") {
    const petition = after.politics?.petitions.find(entry => entry.id === action.petitionId);
    source = `petition:${petition?.defId ?? "?"}:${String(action.response)}`;
  } else if (action.type === "famine_response") {
    source = `famine:${String(action.choice)}`;
  } else if (action.type === "answer_audit") {
    source = action.choice === "punish" ? `steward_punished:${String(action.auditId)}` : `audit:${String(action.choice)}:${String(action.auditId)}`;
  } else {
    const subject = action.suitId ?? action.claimId ?? action.negotiationId ?? action.promiseId ?? action.estateId ?? action.policy ?? action.kind ?? action.permille ?? action.amount;
    source = subject === undefined ? action.type : `${action.type}:${String(subject)}`;
  }
  const id = newHistoryDecision(before, after);
  if (id === undefined) return after;
  const targets = changedTargets(before, after);
  if (decisionKind === "estate_petition") {
    const estateId = after.stewardship?.petitions.find(entry => entry.id === action.petitionId)?.estateId;
    if (estateId !== undefined) targets.push(`estate:${estateId}`);
  }
  // One matter, one decision: a command that carries on a matter the lord decided within the thread's years (the same
  // suit's evidence or enforcement, the same marriage's promises kept, an estate's oversight set up at once) joins it.
  const joined = joinMatter(after, decisionKind, targets, source);
  if (joined !== null) return linkMemories(before, joined);
  // The command's own relation records were applied with it (`recordDecision`): tie them to the decision now.
  return linkMemories(before, addDecision(after, { id, tick: after.tick, by: "lord", kind: decisionKind, source, weights, targets: [...new Set(targets)].sort() }));
}

/** A decision taken inside the tick (the steward's, or a silence): its own record, then its thread. */
function tickDecision(state: GameState, fields: Omit<TracedDecision, "id">, record: { readonly subjectId: string; readonly chosen: string; readonly alternatives: readonly string[] }): GameState {
  const written = appendHistoryRecords(state, [{ tick: state.tick, kind: "decision", subject: TOWN, severity: 1,
    template: fields.lapsed === true ? "decision.lapsed" : "decision.steward",
    params: { decisionKind: fields.kind, subjectId: record.subjectId, chosen: record.chosen, source: fields.source, ...(fields.policy === undefined ? {} : { policy: fields.policy }) },
    decision: { chosen: record.chosen, alternatives: record.alternatives.filter(entry => entry !== record.chosen), predicted: {} } }]);
  return addDecision(written, { id: lastRecordId(written)!, ...fields });
}

/** The steward's answers this tick (home and estate petitions, registry offers) and the matters left to lapse. */
function tickDecisions(before: GameState, after: GameState): GameState {
  let next = after;
  const was = new Map((before.stewardship?.petitions ?? []).map(entry => [entry.id, entry] as const));
  for (const petition of after.stewardship?.petitions ?? []) {
    const old = was.get(petition.id);
    const manor = petition.estateId === HOME_ESTATE_ID;
    if (petition.decidedBy === "steward" && old?.decidedBy !== "steward") {
      next = tickDecision(next, { tick: after.tick, by: "steward", kind: manor ? "manor_petition" : "estate_petition",
        source: manor ? `manor_petition:${petition.kind}:${petition.status}` : `estate_petition:${petition.estateId}:${petition.kind}:${petition.status}`,
        weights: [], ...(petition.policy === undefined ? {} : { policy: petition.policy }), targets: manor ? [] : [`estate:${petition.estateId}`] },
      { subjectId: petition.id, chosen: petition.status, alternatives: ["granted", "refused"] });
    } else if (petition.status === "lapsed" && old !== undefined && old.status === "open") {
      next = tickDecision(next, { tick: after.tick, by: "lord", kind: manor ? "manor_petition" : "estate_petition", lapsed: true,
        source: manor ? `manor_petition:${petition.kind}:lapsed` : `estate_petition:${petition.estateId}:${petition.kind}:lapsed`,
        weights: petition.escalated === "amount" ? ["large_sum"] : petition.escalated === "rights" ? ["rights"] : [], targets: manor ? [] : [`estate:${petition.estateId}`] },
      { subjectId: petition.id, chosen: "lapsed", alternatives: ["granted", "refused"] });
    }
  }
  const offers = new Map((before.registry?.occurrences ?? []).map(entry => [entry.id, entry] as const));
  for (const occurrence of after.registry?.occurrences ?? []) {
    const old = offers.get(occurrence.id);
    if (occurrence.decidedBy === "steward" && old?.decidedBy !== "steward") {
      next = tickDecision(next, { tick: after.tick, by: "steward", kind: "registry", source: `registry:${occurrence.entryId}:${occurrence.choiceId ?? ""}`,
        weights: [], ...(occurrence.policy === undefined ? {} : { policy: occurrence.policy }), targets: changedTargets(before, after) },
      { subjectId: occurrence.id, chosen: occurrence.choiceId ?? "", alternatives: [] });
    } else if (occurrence.status === "lapsed" && old?.status === "offered") {
      next = tickDecision(next, { tick: after.tick, by: "lord", kind: "registry", lapsed: true, source: `registry:${occurrence.entryId}:${occurrence.choiceId ?? "lapsed"}`,
        weights: [...(occurrence.weights ?? [])], targets: changedTargets(before, after) },
      { subjectId: occurrence.id, chosen: "lapsed", alternatives: [] });
    }
  }
  const petitions = new Map((before.politics?.petitions ?? []).map(entry => [entry.id, entry] as const));
  for (const petition of after.politics?.petitions ?? []) {
    const old = petitions.get(petition.id);
    if (petition.response !== "expired" || old === undefined || old.response === "expired") continue;
    next = tickDecision(next, { tick: after.tick, by: "lord", kind: "chapter_petition", lapsed: true, source: `petition:${petition.defId}:expired`,
      weights: ["crisis"], targets: changedTargets(before, after) }, { subjectId: petition.id, chosen: "lapsed", alternatives: [...(petition.options ?? [])] });
  }
  return next;
}

// --- faction memories ----------------------------------------------------------------------------------------------------

/** New memories (a relation moved) tied to the decision of the same words; the decision gains the faction as a target. */
function linkMemories(before: GameState, after: GameState): GameState {
  if (after.factions === undefined || after.factions === before.factions) return after;
  const trace = traceOf(after);
  const decisions = [...trace.decisions];
  const known = new Map((before.factions?.factions ?? []).map(faction => [faction.id, faction.memory.length] as const));
  let changed = false;
  const factions = after.factions.factions.map(faction => {
    const from = known.get(faction.id) ?? 0;
    if (faction.memory.length <= from) return faction;
    const memory: FactionMemory[] = [...faction.memory];
    for (let index = from; index < memory.length; index += 1) {
      const entry = memory[index]!;
      if (entry.decisionId !== undefined) continue;
      let found = -1;
      for (let at = decisions.length - 1; at >= 0; at -= 1) {
        const decision = decisions[at]!;
        if (entry.tick - decision.tick > TRACE_LIVE_TICKS) break;
        const last = decision.lastTick ?? decision.tick;
        if (entry.tick - last > MEMORY_LINK_TICKS || last > entry.tick) continue;
        if (decision.source === entry.reason || decision.also?.includes(entry.reason) === true) { found = at; break; }
      }
      if (found < 0) continue;
      const decision = decisions[found]!;
      memory[index] = { ...entry, decisionId: decision.id };
      const target = `faction:${faction.id}`;
      if (!decision.targets.includes(target)) decisions[found] = { ...decision, targets: [...decision.targets, target].sort() };
      changed = true;
    }
    return { ...faction, memory };
  });
  if (!changed) return after;
  return { ...after, factions: { ...after.factions, factions }, trace: { ...trace, decisions } };
}

// --- consequences ----------------------------------------------------------------------------------------------------------

/** The live decisions on a target, the earliest first (the one that set it going is the main cause). */
export function liveDecisionsOn(trace: TraceState, target: string, tick: number): readonly TracedDecision[] {
  return trace.decisions.filter(decision => tick - (decision.lastTick ?? decision.tick) <= TRACE_LIVE_TICKS && decision.targets.includes(target));
}

/** The decisions behind a record: the main one first; `part` on all when it had other causes, else on all but the main. */
export function becauseOf(causes: readonly string[], key: ConsequenceKey, partial: boolean): HistoryBecause[] {
  return causes.slice(0, BECAUSE_MAX).map((decisionId, index) => ({ decisionId, key, ...(partial || index > 0 ? { part: true as const } : {}) }));
}

/** A consequence written in the history with the decisions behind it (nothing when there are none). */
export function writeConsequence(state: GameState, key: ConsequenceKey, target: string, causes: readonly string[], partial: boolean,
  detail: Readonly<Record<string, string | number>>, subject: ActorRef = TOWN): GameState {
  if (causes.length === 0) return state;
  const draft: HistoryDraft = { tick: state.tick, kind: "event", template: "consequence", subject, severity: 1,
    params: { key, target, ...detail }, because: becauseOf(causes, key, partial) };
  return appendHistoryRecords(state, [draft]);
}

function onTarget(state: GameState, key: ConsequenceKey, target: string, detail: Readonly<Record<string, string | number>>, partial = false): GameState {
  const causes = liveDecisionsOn(traceOf(state), target, state.tick).map(decision => decision.id);
  return writeConsequence(state, key, target, causes, partial, detail);
}

/** The ledger lines a target's later postings fall in (a right's piece, a setting's, a chapter answer's), or null. */
function flowOf(target: string): { readonly key: "right_income" | "payment_flow" | "suit_rent"; readonly categories: readonly string[]; readonly estate?: string; readonly piece?: string } | null {
  if (target.startsWith("right:")) return { key: "right_income", categories: PIECE_INCOME_CATEGORIES[GRANT_PIECE[target.slice("right:".length)]!] ?? [] };
  // SUIT-THREAD (DTR-20): `rent:<estate>|<piece>` — the possession's rent (`possessionRent.ts`; a piece's id holds a colon).
  if (target.startsWith("rent:")) {
    const [estate, piece] = target.slice("rent:".length).split("|");
    return { key: "suit_rent", categories: ["estate_income"], estate: estate!, piece: piece ?? estate! };
  }
  if (target.startsWith("flow:")) {
    // `flow:<category>@<estate>`: that estate's own postings only (its season's yield, not a petition's).
    const [category, estate] = target.slice("flow:".length).split("@");
    return { key: "payment_flow", categories: [category!], ...(estate === undefined ? {} : { estate }) };
  }
  const categories = TARGET_FLOWS[target];
  return categories === undefined ? null : { key: "payment_flow", categories };
}

/** A posting falls in a flow: its category, its estate when the flow names one; rights count only cash coming in. */
function inFlow(entry: LedgerEntry, flow: NonNullable<ReturnType<typeof flowOf>>): boolean {
  if (!flow.categories.includes(entry.category)) return false;
  if (flow.key === "right_income") return entry.account === "cash" && entry.amount > 0;
  if (flow.key === "suit_rent") return entry.amount > 0 && entry.sourceRefs.some(ref => ref.type === "right" && ref.id === flow.piece && ref.detail === POSSESSION_RENT_DETAIL);
  if (flow.estate !== undefined) return entry.sourceRefs.some(ref => ref.type === "actor" && ref.id === `estate:${flow.estate}`)
    && !entry.sourceRefs.some(ref => ref.type === "claim");
  return true;
}

/** The decision's first such posting is already written (the history's records since the decision, newest first). */
function followed(state: GameState, decision: TracedDecision, key: ConsequenceKey, target: string): boolean {
  const records = state.history?.records ?? [];
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index]!;
    if (record.tick < decision.tick) return false;
    if (record.template === "consequence" && record.params?.key === key && record.params?.target === target
      && record.because?.some(entry => entry.decisionId === decision.id) === true) return true;
  }
  return false;
}

/** What happened this tick to the live decisions' targets. */
function consequences(before: GameState, after: GameState): GameState {
  let next = after;
  const suits = new Map((before.estates?.suits ?? []).map(suit => [suit.id, suit] as const));
  for (const suit of after.estates?.suits ?? []) {
    const old = suits.get(suit.id);
    if (old !== undefined && (old.stage !== suit.stage || old.verdict !== suit.verdict || old.enforced !== suit.enforced)) {
      next = onTarget(next, "suit_turned", `suit:${suit.id}`, { stage: suit.stage, ...(suit.verdict === undefined ? {} : { verdict: suit.verdict }) });
    }
  }
  const negotiations = new Map((before.diplomacy?.negotiations ?? []).map(entry => [entry.id, entry] as const));
  for (const entry of after.diplomacy?.negotiations ?? []) {
    const old = negotiations.get(entry.id);
    if (old !== undefined && old.status !== entry.status) next = onTarget(next, "marriage_turned", `negotiation:${entry.id}`, { status: entry.status });
  }
  const promises = new Map((before.diplomacy?.promises ?? []).map(entry => [entry.id, entry] as const));
  for (const entry of after.diplomacy?.promises ?? []) {
    const old = promises.get(entry.id);
    if (old !== undefined && old.status !== entry.status) {
      next = onTarget(next, entry.status === "broken" ? "promise_broken" : "promise_kept", `promise:${entry.id}`, { term: entry.term });
    } else if (old === undefined) {
      // A promise the negotiation made carries on the negotiation's thread.
      next = onTarget(next, "promise_made", `negotiation:${entry.negotiationId}`, { term: entry.term });
    }
  }
  // A marriage's own turns (the contract's stages, the bride's coming, a child, a will) carry on its negotiation's thread.
  const plan = after.diplomacy?.marriage, oldPlan = before.diplomacy?.marriage;
  if (plan !== undefined && plan !== oldPlan && (oldPlan === undefined || oldPlan.stage !== plan.stage || Object.keys(plan.events).length !== Object.keys(oldPlan.events).length)) {
    next = onTarget(next, "marriage_turned", `negotiation:${plan.negotiationId}`, { stage: plan.stage, events: Object.keys(plan.events).length });
  }
  const audits = new Set((before.stewardship?.audits ?? []).map(entry => entry.id));
  for (const audit of after.stewardship?.audits ?? []) {
    if (!audits.has(audit.id)) next = onTarget(next, "audit", `estate:${audit.estateId}`, { revealed: audit.revealedKept + audit.revealedErrors, status: audit.status });
  }
  // An off-map estate's tenants or merchants crossing a band of twenty in its season (their mood shows in its yield).
  const summaries = before.stewardship?.summaries.length ?? 0;
  for (const summary of (after.stewardship?.summaries ?? []).slice(summaries)) {
    const previous = [...(before.stewardship?.summaries ?? [])].reverse().find(entry => entry.estateId === summary.estateId);
    if (previous === undefined) continue;
    const band = (value: number) => Math.floor(value / ESTATE_MOOD_BAND);
    if (band(previous.tenants) !== band(summary.tenants) || band(previous.merchants) !== band(summary.merchants)) {
      next = onTarget(next, "estate_mood", `estate:${summary.estateId}`, { tenants: summary.tenants, merchants: summary.merchants, income: summary.income }, true);
    }
  }
  const receipts = new Set((before.agency?.receipts ?? []).map(entry => entry.id));
  for (const receipt of after.agency?.receipts ?? []) {
    if (receipts.has(receipt.id)) continue;
    const live = traceOf(next).decisions.filter(decision => next.tick - (decision.lastTick ?? decision.tick) <= TRACE_LIVE_TICKS
      && ((receipt.subsidy > 0 && decision.targets.includes(`subsidy:${receipt.what}`)) || decision.targets.includes(`build:${receipt.what}`) || receipt.decisionIds.includes(decision.id)));
    const named = live.filter(decision => decision.targets.includes(`subsidy:${receipt.what}`) || decision.targets.includes(`build:${receipt.what}`));
    const causes = [...named, ...live.filter(decision => !named.includes(decision))].map(decision => decision.id);
    // P-C2: a project the actor chose by its reasons — the lord's conditions were a share of them, never all.
    next = writeConsequence(next, "project_started", `build:${receipt.what}`, causes, true, { what: receipt.what, actor: receipt.actor, subsidy: receipt.subsidy, receipt: receipt.id });
    // DTR-15 (the user's instruction): a need its builder refused, built by the community after the wait and at a premium —
    // behind it the decisions that turned the builder's mind (live on its faction); written even when none did (A4).
    if (receipt.fallback !== undefined) {
      const builderFaction = FACTION_OF_ACTOR[receipt.fallback.builder];
      const turned = liveDecisionsOn(traceOf(next), `faction:${builderFaction}`, next.tick).map(decision => decision.id);
      const detail = { what: receipt.what, builder: receipt.fallback.builder, delay: receipt.tick - receipt.fallback.since,
        premium: receipt.fallback.premium, treasury: receipt.fallback.treasury, receipt: receipt.id };
      next = appendHistoryRecords(next, [{ tick: next.tick, kind: "event", template: "consequence", subject: TOWN, severity: 2,
        params: { key: "community_built", target: `faction:${builderFaction}`, ...detail }, ...(turned.length === 0 ? {} : { because: becauseOf(turned, "community_built", true) }) }]);
    }
  }
  // A granted right's first income after the grant (the stall fees of a market charter, the tolls of a bridge); DTR-11:
  // the first posting of the ledger lines a decision set going (the dues' stall fees, the wool in kind, the wages).
  const fresh = after.ledger === before.ledger || after.ledger === undefined ? 0 : after.ledger.nextEntryOrdinal - (before.ledger?.nextEntryOrdinal ?? 1);
  const posted = fresh <= 0 ? [] : after.ledger!.entries.slice(-fresh).filter(entry => entry.amount !== 0);
  if (posted.length > 0) {
    for (const decision of traceOf(next).decisions) {
      if (next.tick - (decision.lastTick ?? decision.tick) > TRACE_LIVE_TICKS) continue;
      for (const target of decision.targets) {
        const flow = flowOf(target);
        if (flow === null) continue;
        const amounts = posted.filter(entry => inFlow(entry, flow));
        if (amounts.length === 0 || followed(next, decision, flow.key, target)) continue;
        const income = amounts.filter(entry => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
        const expense = -amounts.filter(entry => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0);
        // SUIT-THREAD: the rent names its judgment's year ("○○년 판결로").
        next = writeConsequence(next, flow.key, target, [decision.id], flow.key !== "suit_rent",
          flow.key === "right_income" ? { income } : flow.key === "suit_rent" ? { income, year: scenarioYear(next, decision.tick), estate: flow.estate! }
            : { category: amounts[0]!.category, income, expense });
      }
    }
  }
  if ((after.timberOrder ?? 0) < (before.timberOrder ?? 0)) {
    const latest = liveDecisionsOn(traceOf(next), "timber", next.tick).at(-1);
    if (latest !== undefined) next = writeConsequence(next, "goods_delivered", "timber", [latest.id], false, { brought: (before.timberOrder ?? 0) - (after.timberOrder ?? 0) });
  }
  next = crises(before, after, next);
  // Households gone this tick for a decision's reason: the refused guild's weavers, the war tax's flight.
  const gone = after.houses.filter((house, index) => house.abandonedTick === after.tick && before.houses[index]?.abandonedTick !== after.tick).length;
  if (gone > 0) {
    if (after.reorganisation?.weaversLeftTick === after.tick && before.reorganisation?.weaversLeftTick !== after.tick) {
      next = onTarget(next, "households_left", "guild", { households: gone });
    } else if ((after.war?.taxSeasonsLeft ?? 0) > 0) {
      next = onTarget(next, "households_left", "war_tax", { households: gone }, true);
    }
  }
  return next;
}

/** The decisions of the last two years that prepared for a dearth (stores and granaries, the policy, timber). */
const PREPARES = /^(subsidy:(granary|storehouse|mill|farmstead|wheat_farm)|policy|timber)$/;

/**
 * DEC-TRACE §6: a dearth's arrival (the preparedness then, with the decisions that prepared) and its outcome (the damage,
 * or why it was avoided — the stores, the relief, or a weak dearth), with the lord's answer to it first.
 */
function crises(before: GameState, after: GameState, state: GameState): GameState {
  let next = state;
  const known = new Map((before.events?.records ?? []).map(record => [record.id, record] as const));
  for (const record of after.events?.records ?? []) {
    if (record.kind !== "dearth") continue;
    const old = known.get(record.id);
    if (old === undefined) {
      const prep = preparedness(next);
      const prepared = traceOf(next).decisions.filter(decision => next.tick - decision.tick <= 2 * YEAR && decision.targets.some(target => PREPARES.test(target))).map(decision => decision.id);
      next = appendHistoryRecords(next, [{ tick: next.tick, kind: "event", template: "crisis.arrived", subject: TOWN, severity: 2,
        params: { eventId: record.id, foodDays: prep.foodDays ?? -1, granaries: prep.granaries, markets: prep.markets, shortHouseholds: prep.shortHouseholds,
          weakPoints: prep.weakPoints.join(","), policy: prep.policy ?? "" },
        ...(prepared.length === 0 ? {} : { because: becauseOf(prepared, "crisis_prepared", true) }) }]);
    } else if (old.endTick === undefined && record.endTick !== undefined) {
      const arrived = next.history?.records.find(entry => entry.template === "crisis.arrived" && entry.params?.eventId === record.id);
      const fromYear = scenarioYear(next, record.arrivalTick), toYear = scenarioYear(next, record.endTick);
      const deaths = (next.persons?.past ?? []).filter(person => (person.deathCause === "famine" || person.deathCause === "famine_year")
        && (person.deathYear ?? -1) >= fromYear && (person.deathYear ?? -1) <= toYear).length;
      const departures = record.losses.departures;
      const drop = (record.populationAtArrival ?? 0) - (record.populationAtEnd ?? record.populationAtArrival ?? 0);
      const foodDays = Number(arrived?.params?.foodDays ?? -1);
      const avoided = deaths === 0 && departures === 0;
      const reason = !avoided ? "damage" : foodDays >= CRISIS_RESERVE_DAYS ? "stores" : record.response?.choice === "relief" ? "relief" : "weak";
      const answered = liveDecisionsOn(traceOf(next), `event:${record.id}`, next.tick).map(decision => decision.id);
      const prepared = (arrived?.because ?? []).map(entry => entry.decisionId);
      const causes = [...answered, ...prepared.filter(id => !answered.includes(id))];
      next = writeConsequence(next, "crisis_outcome", `event:${record.id}`, causes, prepared.length > 0 || answered.length === 0,
        { eventId: record.id, deaths, departures, populationDrop: drop, harvestLost: record.losses.harvestLost, avoided: avoided ? 1 : 0, reason });
      // A dearth no decision touched still gets its line (A4: the reason shown, even when it was no one's).
      if (causes.length === 0) next = appendHistoryRecords(next, [{ tick: next.tick, kind: "event", template: "consequence", subject: TOWN, severity: 1,
        params: { key: "crisis_outcome", target: `event:${record.id}`, eventId: record.id, deaths, departures, populationDrop: drop, harvestLost: record.losses.harvestLost, avoided: avoided ? 1 : 0, reason } }]);
    }
  }
  return next;
}

const scenarioYear = (state: GameState, tick: number) => stateCalendar({ ...state, tick }).year;

/** P-T6: the thread keeps ten years of decisions and acts (their records stay in the history). */
function prune(state: GameState): GameState {
  const trace = traceOf(state);
  const from = state.tick - TRACE_KEPT_TICKS;
  if ((trace.decisions[0]?.tick ?? Infinity) >= from && (trace.acts[0]?.tick ?? Infinity) >= from) return state;
  return { ...state, trace: { decisions: trace.decisions.filter(entry => (entry.lastTick ?? entry.tick) >= from), acts: trace.acts.filter(entry => entry.tick >= from) } };
}

/** DEC-TRACE §2: the tick's thread — the steward's answers and the silences, the factions' memories tied, the consequences. Lord mode only. */
export function advanceTrace(before: GameState, after: GameState): GameState {
  if (after.agency === undefined) return after;
  let next = tickDecisions(before, after);
  next = linkMemories(before, next);
  next = consequences(before, next);
  return after.tick % YEAR === 0 ? prune(next) : next;
}

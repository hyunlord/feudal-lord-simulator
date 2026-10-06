/**
 * DEC-TRACE §2 (docs/design/dec-trace.md, A4·A5·A6, P-C1·P-C2·P-C3): the thread of consequence, lord mode only.
 *
 * - A decision is kept when a command of the lord's changed the state (`traceCommand`) or the steward answered a matter
 *   by the lord's standing policy (`advanceTrace`), with what it touched (its targets, from the state before and after).
 * - A faction's memory of a relation change is tied to the decision whose words it carries (the same reason key).
 * - What later happens to a target within three years is a consequence, with the decisions behind it (the main one
 *   first; `partial` when it had other causes or other decisions had a share).
 * Reading the thread never changes the simulation; the faction acts (`factionActs.ts`) read the memories' decisions.
 */
import { GUILD_CHARTER_PETITION_ID } from "../content/reorganisationConfig";
import { MARKET_CHARTER_PETITION_ID } from "../content/chapterConfig";
import { GRANT_PIECE, PIECE_INCOME_CATEGORIES } from "../content/estateConfig";
import { BALANCE } from "../content/balanceConfig";
import type { DecisionWeight, StewardStance } from "../content/stewardPolicyConfig";
import { COMMAND_WEIGHT } from "../content/stewardPolicyConfig";
import type { GameState } from "./engine.types";
import type { FactionMemory } from "./faction.types";
import type { Consequence, ConsequenceKind, TracedDecision, TracedDecisionKind, TraceState } from "./decisionTrace.types";

const YEAR = BALANCE.TICKS_PER_YEAR;
/** A decision's targets stay live this long (the user's gate: a consequence within three years). */
export const TRACE_LIVE_TICKS = 3 * YEAR;
/** P-T6: what the thread keeps (the chronicle keeps the rest). */
const TRACE_KEPT_TICKS = 10 * YEAR;
/** A faction's memory is tied to a decision of the same words within this many ticks (the history writes it a tick on). */
const MEMORY_LINK_TICKS = 4;
/** The kinds of building a chapter petition's acceptance opens (its consequence is the town's project of that kind). */
const PETITION_OPENS: Readonly<Record<string, readonly string[]>> = { [MARKET_CHARTER_PETITION_ID]: ["market"] };
/** An off-map estate's mood counts as moved when it crosses a band this wide. */
const ESTATE_MOOD_BAND = 20;

export function traceOf(state: Pick<GameState, "trace">): TraceState {
  return state.trace ?? { decisions: [], consequences: [], acts: [], nextDecision: 1, nextConsequence: 1 };
}

const pad = (value: number) => String(value).padStart(6, "0");

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
  for (const suit of after.estates?.suits ?? []) if (suits.get(suit.id) !== suit) targets.add(`suit:${suit.id}`);
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
    const was = before.politics?.petitions.find(entry => entry.id === petition.id);
    if (petition.response === "accept" && was?.response !== "accept") for (const kind of PETITION_OPENS[petition.defId] ?? []) targets.add(`build:${kind}`);
  }
  // A right granted: its income (its piece's ledger categories) is what follows from it.
  const rights = new Set((before.politics?.rights ?? []).map(right => right.id));
  for (const right of after.politics?.rights ?? []) {
    const id = right.id.split("@")[0]!;
    if (!rights.has(right.id) && GRANT_PIECE[id] !== undefined) targets.add(`right:${id}`);
  }
  const guild = (state: GameState) => state.politics?.petitions.find(petition => petition.defId === GUILD_CHARTER_PETITION_ID)?.response;
  if (guild(before) !== guild(after) && guild(after) !== undefined) targets.add("guild");
  return [...targets].sort();
}

// --- decisions ------------------------------------------------------------------------------------------------------------

function addDecision(state: GameState, fields: Omit<TracedDecision, "id">): GameState {
  const trace = traceOf(state);
  const decision: TracedDecision = { id: `d-${pad(trace.nextDecision)}`, ...fields };
  return { ...state, trace: { ...trace, decisions: [...trace.decisions, decision], nextDecision: trace.nextDecision + 1 } };
}

/** The history ledger's decision record the command just wrote (the agency's receipts cite it). */
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
  set_estate_policy: "policy", set_project_subsidy: "subsidy", set_market_dues: "dues", order_timber: "timber", set_steward_policy: "steward_policy",
};

/**
 * DEC-TRACE §2: a command of the lord's that changed the state, kept as a decision with what it touched. Its source is
 * the same key the factions' memories carry for it (`registry:<entry>:<choice>`, `manor_petition:<kind>:<answer>`,
 * `petition:<def>:<answer>`, `famine:<choice>`, `steward_punished:<audit>`), so their changes are tied to it.
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
    source = `registry:${occurrence?.entryId ?? "?"}:${String(action.choiceId)}`;
    weights = [...(occurrence?.weights ?? [])];
  } else if (action.type === "answer_estate_petition") {
    const petition = after.stewardship?.petitions.find(entry => entry.id === action.petitionId);
    const manor = petition?.estateId === "estate-home";
    decisionKind = manor ? "manor_petition" : "estate_petition";
    source = manor ? `manor_petition:${petition?.kind}:${petition?.status}` : `estate_petition:${petition?.estateId}:${petition?.kind}:${petition?.status}`;
    weights = petition?.escalated === "amount" ? ["large_sum"] : petition?.rights === true ? ["rights"] : [];
  } else if (action.type === "petition_response") {
    const petition = after.politics?.petitions.find(entry => entry.id === action.petitionId);
    source = `petition:${petition?.defId ?? "?"}:${String(action.response)}`;
  } else if (action.type === "famine_response") {
    source = `famine:${String(action.choice)}`;
  } else if (action.type === "answer_audit") {
    source = action.choice === "punish" ? `steward_punished:${String(action.auditId)}` : `audit:${String(action.choice)}:${String(action.auditId)}`;
  } else {
    const subject = action.suitId ?? action.claimId ?? action.negotiationId ?? action.promiseId ?? action.estateId ?? action.policy ?? action.kind ?? action.permille ?? action.amount ?? action.key;
    source = subject === undefined ? action.type : `${action.type}:${String(subject)}`;
  }
  const historyId = newHistoryDecision(before, after);
  const targets = changedTargets(before, after);
  if (decisionKind === "estate_petition") {
    const estateId = after.stewardship?.petitions.find(entry => entry.id === action.petitionId)?.estateId;
    if (estateId !== undefined) targets.push(`estate:${estateId}`);
  }
  // One matter, one decision: a command that carries on a matter the lord decided within the year (the same suit's
  // evidence or enforcement, the same marriage's promises kept, an estate's oversight set up at once) joins it.
  const joined = joinMatter(after, decisionKind, targets, source);
  if (joined !== null) return linkMemories(before, joined);
  // The command's own relation records were applied with it (`recordDecision`): tie them to the decision now.
  return linkMemories(before, addDecision(after, { tick: after.tick, by: "lord", kind: decisionKind, source, weights, targets: [...new Set(targets)].sort(),
    ...(historyId === undefined ? {} : { historyId }) }));
}

/** The matters a decision's thread follows as one (a suit, a marriage, an estate's oversight). */
const MATTER = /^(suit|negotiation|estate):/;

/** A lord's command that carries on a matter he decided within the year joins that decision (its targets grow), or null. */
function joinMatter(state: GameState, kind: TracedDecisionKind, targets: readonly string[], source: string): GameState | null {
  const trace = traceOf(state);
  const matters = targets.filter(target => MATTER.test(target));
  const sameMoment = kind === "oversight";
  for (let index = trace.decisions.length - 1; index >= 0; index -= 1) {
    const earlier = trace.decisions[index]!;
    if (state.tick - (earlier.lastTick ?? earlier.tick) > TRACE_LIVE_TICKS) continue;
    if (state.tick - earlier.tick > 2 * TRACE_LIVE_TICKS) break;
    if (earlier.by !== "lord" || earlier.kind !== kind) continue;
    const shared = matters.some(target => earlier.targets.includes(target));
    if (!shared && !(sameMoment && earlier.tick === state.tick)) continue;
    const decisions = [...trace.decisions];
    decisions[index] = { ...earlier, targets: [...new Set([...earlier.targets, ...targets])].sort(),
      also: [...new Set([...(earlier.also ?? []), source])].filter(key => key !== earlier.source), lastTick: state.tick };
    return { ...state, trace: { ...trace, decisions } };
  }
  return null;
}

/** The steward's answers this tick (home and estate petitions, registry offers), each by the lord's standing policy. */
function stewardDecisions(before: GameState, after: GameState): GameState {
  let next = after;
  const was = new Map((before.stewardship?.petitions ?? []).map(entry => [entry.id, entry] as const));
  for (const petition of after.stewardship?.petitions ?? []) {
    if (petition.decidedBy !== "steward" || was.get(petition.id)?.decidedBy === "steward") continue;
    const manor = petition.estateId === "estate-home";
    next = addDecision(next, { tick: after.tick, by: "steward", kind: manor ? "manor_petition" : "estate_petition",
      source: manor ? `manor_petition:${petition.kind}:${petition.status}` : `estate_petition:${petition.estateId}:${petition.kind}:${petition.status}`,
      weights: [], ...(petition.stance === undefined ? {} : { stance: petition.stance as StewardStance }), targets: manor ? [] : [`estate:${petition.estateId}`] });
  }
  const offers = new Map((before.registry?.occurrences ?? []).map(entry => [entry.id, entry] as const));
  for (const occurrence of after.registry?.occurrences ?? []) {
    if (occurrence.decidedBy !== "steward" || offers.get(occurrence.id)?.decidedBy === "steward") continue;
    next = addDecision(next, { tick: after.tick, by: "steward", kind: "registry", source: `registry:${occurrence.entryId}:${occurrence.choiceId ?? ""}`,
      weights: [], ...(occurrence.stance === undefined ? {} : { stance: occurrence.stance }), targets: changedTargets(before, after) });
  }
  return next;
}

// --- faction memories ----------------------------------------------------------------------------------------------------

/** New memories (a relation moved) tied to the decision of the same words; the decision gains the faction as a target. */
function linkMemories(before: GameState, after: GameState): GameState {
  if (after.factions === undefined || after.factions === before.factions) return after;
  let trace = traceOf(after);
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
        if (entry.tick - decision.tick > YEAR) break;
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
  trace = { ...trace, decisions };
  return { ...after, factions: { ...after.factions, factions }, trace };
}

// --- consequences ----------------------------------------------------------------------------------------------------------

/** The live decisions on a target, the earliest first (the one that set it going is the main cause). */
export function liveDecisionsOn(trace: TraceState, target: string, tick: number): readonly TracedDecision[] {
  return trace.decisions.filter(decision => tick - decision.tick <= TRACE_LIVE_TICKS && decision.targets.includes(target));
}

export function addConsequence(state: GameState, kind: ConsequenceKind, target: string, causes: readonly string[], partial: boolean,
  detail: Readonly<Record<string, string | number>>): GameState {
  if (causes.length === 0) return state;
  const trace = traceOf(state);
  const consequence: Consequence = { id: `c-${pad(trace.nextConsequence)}`, tick: state.tick, kind, target, causes, partial: partial || causes.length > 1, detail };
  return { ...state, trace: { ...trace, consequences: [...trace.consequences, consequence], nextConsequence: trace.nextConsequence + 1 } };
}

function onTarget(state: GameState, kind: ConsequenceKind, target: string, detail: Readonly<Record<string, string | number>>, partial = false): GameState {
  const causes = liveDecisionsOn(traceOf(state), target, state.tick).map(decision => decision.id);
  return addConsequence(state, kind, target, causes, partial, detail);
}

/** What happened this tick to the live decisions' targets. */
function consequences(before: GameState, after: GameState): GameState {
  let next = after;
  const suits = new Map((before.estates?.suits ?? []).map(suit => [suit.id, suit] as const));
  for (const suit of after.estates?.suits ?? []) {
    const old = suits.get(suit.id);
    if (old !== undefined && (old.stage !== suit.stage || old.verdict !== suit.verdict || old.enforced !== suit.enforced)) {
      next = onTarget(next, "suit", `suit:${suit.id}`, { stage: suit.stage, ...(suit.verdict === undefined ? {} : { verdict: suit.verdict }) });
    }
  }
  const negotiations = new Map((before.diplomacy?.negotiations ?? []).map(entry => [entry.id, entry] as const));
  for (const entry of after.diplomacy?.negotiations ?? []) {
    const old = negotiations.get(entry.id);
    if (old !== undefined && old.status !== entry.status) next = onTarget(next, "marriage", `negotiation:${entry.id}`, { status: entry.status });
  }
  const promises = new Map((before.diplomacy?.promises ?? []).map(entry => [entry.id, entry] as const));
  for (const entry of after.diplomacy?.promises ?? []) {
    const old = promises.get(entry.id);
    if (old !== undefined && old.status !== entry.status) next = onTarget(next, "promise", `promise:${entry.id}`, { status: entry.status });
    if (old === undefined) {
      // A promise the negotiation made carries on the negotiation's thread.
      const causes = liveDecisionsOn(traceOf(next), `negotiation:${entry.negotiationId}`, next.tick).map(decision => decision.id);
      next = addConsequence(next, "promise", `negotiation:${entry.negotiationId}`, causes, false, { status: "made", term: entry.term });
    }
  }
  // A marriage's own turns (the contract's stages, the bride's coming, a child, a will) carry on its negotiation's thread.
  const plan = after.diplomacy?.marriage, oldPlan = before.diplomacy?.marriage;
  if (plan !== undefined && plan !== oldPlan && (oldPlan === undefined || oldPlan.stage !== plan.stage || Object.keys(plan.events).length !== Object.keys(oldPlan.events).length)) {
    next = onTarget(next, "marriage", `negotiation:${plan.negotiationId}`, { stage: plan.stage, events: Object.keys(plan.events).length });
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
      next = onTarget(next, "estate", `estate:${summary.estateId}`, { tenants: summary.tenants, merchants: summary.merchants, income: summary.income }, true);
    }
  }
  const receipts = new Set((before.agency?.receipts ?? []).map(entry => entry.id));
  for (const receipt of after.agency?.receipts ?? []) {
    if (receipts.has(receipt.id)) continue;
    const trace = traceOf(next);
    const live = trace.decisions.filter(decision => next.tick - decision.tick <= TRACE_LIVE_TICKS
      && ((receipt.subsidy > 0 && decision.targets.includes(`subsidy:${receipt.what}`)) || decision.targets.includes(`build:${receipt.what}`)
        || (decision.historyId !== undefined && receipt.decisionIds.includes(decision.historyId))));
    const subsidised = live.filter(decision => decision.targets.includes(`subsidy:${receipt.what}`));
    const causes = [...subsidised, ...live.filter(decision => !subsidised.includes(decision))].map(decision => decision.id);
    // P-C2: a project the actor chose by its reasons — the lord's conditions were a share of them, never all.
    next = addConsequence(next, "project", receipt.what, causes, true, { what: receipt.what, actor: receipt.actor, subsidy: receipt.subsidy });
  }
  // A granted right's first income after the grant (the stall fees of a market charter, the tolls of a bridge).
  // The entries posted this tick are the last ones (the ledger appends; its ordinal counts them).
  const fresh = after.ledger === before.ledger || after.ledger === undefined ? 0 : after.ledger.nextEntryOrdinal - (before.ledger?.nextEntryOrdinal ?? 1);
  const posted = fresh <= 0 ? [] : after.ledger!.entries.slice(-fresh).filter(entry => entry.amount > 0);
  if (posted.length > 0) {
    for (const decision of traceOf(next).decisions) {
      if (next.tick - decision.tick > TRACE_LIVE_TICKS) continue;
      for (const target of decision.targets.filter(entry => entry.startsWith("right:"))) {
        const categories = PIECE_INCOME_CATEGORIES[GRANT_PIECE[target.slice("right:".length)]!] ?? [];
        const income = posted.filter(entry => categories.includes(entry.category)).reduce((sum, entry) => sum + entry.amount, 0);
        if (income <= 0 || traceOf(next).consequences.some(entry => entry.kind === "income" && entry.target === target && entry.causes.includes(decision.id))) continue;
        next = addConsequence(next, "income", target, [decision.id], true, { income });
      }
    }
  }
  if ((after.timberOrder ?? 0) < (before.timberOrder ?? 0)) {
    const latest = liveDecisionsOn(traceOf(next), "timber", next.tick).at(-1);
    if (latest !== undefined) next = addConsequence(next, "goods", "timber", [latest.id], false, { brought: (before.timberOrder ?? 0) - (after.timberOrder ?? 0) });
  }
  // Households gone this tick for a decision's reason: the refused guild's weavers, the war tax's flight.
  const gone = after.houses.filter((house, index) => house.abandonedTick === after.tick && before.houses[index]?.abandonedTick !== after.tick).length;
  if (gone > 0) {
    if (after.reorganisation?.weaversLeftTick === after.tick && before.reorganisation?.weaversLeftTick !== after.tick) {
      next = onTarget(next, "departure", "guild", { households: gone });
    } else if ((after.war?.taxSeasonsLeft ?? 0) > 0) {
      next = onTarget(next, "departure", "war_tax", { households: gone }, true);
    }
  }
  return next;
}

/** P-T6: the thread keeps ten years; the chronicle keeps the rest. */
function prune(state: GameState): GameState {
  const trace = traceOf(state);
  const from = state.tick - TRACE_KEPT_TICKS;
  if ((trace.decisions[0]?.tick ?? Infinity) >= from && (trace.consequences[0]?.tick ?? Infinity) >= from && (trace.acts[0]?.tick ?? Infinity) >= from) return state;
  return { ...state, trace: { ...trace, decisions: trace.decisions.filter(entry => entry.tick >= from),
    consequences: trace.consequences.filter(entry => entry.tick >= from), acts: trace.acts.filter(entry => entry.tick >= from) } };
}

/** DEC-TRACE §2: the tick's thread — the steward's answers, the factions' memories tied, the consequences. Lord mode only. */
export function advanceTrace(before: GameState, after: GameState): GameState {
  if (after.agency === undefined) return after;
  let next = stewardDecisions(before, after);
  next = linkMemories(before, next);
  next = consequences(before, next);
  return after.tick % YEAR === 0 ? prune(next) : next;
}

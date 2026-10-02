/**
 * LM-E9 (spec docs/design/registry.md ER-1…ER-12): the registry — petitions, events and annual rules as data, offered
 * in lord mode in a stable order (conditions → the seed's draw → conflicts → atomic update → receipt), answered through
 * commands the engine already has. Nothing runs without `state.agency`.
 */
import type { BuildingKind } from "../content/buildingConfig";
import { ALL_REGISTRY_ENTRIES } from "../content/registry/registryEntries";
import {
  REGISTRY_BINDS, REGISTRY_FIELDS, REGISTRY_KINDS, REGISTRY_OPS,
  type RegistryCondition, type RegistryEffect, type RegistryEntry,
} from "../content/registry/registryTypes";
import { postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { GameState } from "./engine.types";
import { estatesOf } from "./estates";
import { addSuitEvidence, enforcePossession, fileSuit } from "./estateSuits";
import { hashSeed } from "./prng";
import type { LordHouse, RegistryOccurrence, RegistryState, RegistryTerm } from "./registry.types";
import { stateCalendar } from "./scenarioState";
import { answerAudit, attention, heldOffMapEstates, pendingAudits, setAuditMode, setEstateOversight, setExceptionRules, stewardshipOf } from "./stewardship";
import { orderTimber } from "./timberTrade";
import { setEstatePolicy, setMarketDues, setProjectSubsidy } from "./townAgency";

const SEASON = 1_000;
const YEAR = 4_000;
/** ER-3 (the drafts' proposal): new events at most one a season and two a year. */
export const REGISTRY_EVENTS_PER_SEASON = 1;
export const REGISTRY_EVENTS_PER_YEAR = 2;
/** ER-4: an offer is answered within a season. */
export const REGISTRY_ANSWER_TICKS = 1_000;
const MAX_OCCURRENCES_KEPT = 400;
/** ER-9: the player's house by default (the user's decision 2026-10-02). */
export const DEFAULT_LORD_HOUSE: LordHouse = { name: "de Haverel", arms: "haverel" };

// --- ER-2 load and validation ----------------------------------------------------------------------------------------

export interface RegistryRejection { readonly id: string; readonly reason: string }

const COMMANDS: ReadonlySet<string> = new Set(["set_project_subsidy", "set_market_dues", "set_estate_policy", "set_audit_mode", "answer_audit",
  "set_estate_oversight", "add_suit_evidence", "file_suit", "order_timber", "faction_relation", "treasury", "term", "rights_scope",
  "set_exception_rules", "enforce_possession", "none"]);

function conditionProblem(condition: RegistryCondition): string | null {
  if ("all" in condition) return condition.all.length === 0 ? "empty all" : condition.all.map(conditionProblem).find(problem => problem !== null) ?? null;
  if ("any" in condition) return condition.any.length === 0 ? "empty any" : condition.any.map(conditionProblem).find(problem => problem !== null) ?? null;
  if ("not" in condition) return conditionProblem(condition.not);
  if (!(REGISTRY_FIELDS as readonly string[]).includes(condition.field)) return `unknown field ${condition.field}`;
  if (!(REGISTRY_OPS as readonly string[]).includes(condition.op)) return `unknown op ${condition.op}`;
  if (condition.op === "in" && !Array.isArray(condition.value)) return "in needs a list";
  if ((condition.op === "has" || condition.op === "lacks") && (condition.field !== "bound.evidence" || typeof condition.value !== "string")) return `${condition.op} needs bound.evidence and a kind`;
  if ((condition.op === "gte" || condition.op === "lte") && typeof condition.value !== "number") return `${condition.op} needs a number`;
  if (condition.field === "faction.relation" && condition.faction === undefined) return "faction.relation needs a faction";
  return null;
}

/** ER-2: an entry's problem, or null — a wrong entry is left out whole. */
export function entryProblem(entry: RegistryEntry): string | null {
  if (typeof entry.id !== "string" || entry.id.length === 0) return "no id";
  if (!(REGISTRY_KINDS as readonly string[]).includes(entry.kind)) return `unknown kind ${entry.kind}`;
  if (!(REGISTRY_BINDS as readonly string[]).includes(entry.bind)) return `unknown bind ${entry.bind}`;
  if (entry.window.fromYear > entry.window.toYear) return "empty window";
  const frequency = entry.frequency;
  if (frequency.chancePermille < 0 || frequency.chancePermille > 1000) return "chance outside 0–1000";
  if (frequency.weight < 1 || !Number.isInteger(frequency.weight)) return "weight must be a whole number of 1 or more";
  if (frequency.maxPerYear < 1) return "maxPerYear must be 1 or more";
  if (entry.recurrence.mode === "once" && entry.recurrence.maxOccurrences !== 1) return "once must have maxOccurrences 1";
  if (entry.choices.length < 2) return "fewer than two choices";
  if (new Set(entry.choices.map(choice => choice.id)).size !== entry.choices.length) return "choice ids repeat";
  for (const choice of entry.choices) {
    for (const effect of choice.effects) if (!COMMANDS.has(effect.command)) return `unknown command ${effect.command}`;
    if (choice.requires !== undefined) { const problem = conditionProblem(choice.requires); if (problem !== null) return `${choice.id}: ${problem}`; }
  }
  if (entry.lapseChoice !== undefined && !entry.choices.some(choice => choice.id === entry.lapseChoice)) return "lapse choice not among the choices";
  if (entry.conditions !== undefined) { const problem = conditionProblem(entry.conditions); if (problem !== null) return problem; }
  return null;
}

/** ER-2: the registry as loaded — the entries that pass, and those left out with their reason. */
export function registryLoad(entries: readonly RegistryEntry[] = ALL_REGISTRY_ENTRIES): { readonly entries: readonly RegistryEntry[]; readonly rejected: readonly RegistryRejection[] } {
  const seen = new Set<string>();
  const accepted: RegistryEntry[] = [];
  const rejected: RegistryRejection[] = [];
  for (const entry of entries) {
    const problem = seen.has(entry.id) ? "id repeats" : entryProblem(entry);
    if (problem === null) { accepted.push(entry); seen.add(entry.id); } else rejected.push({ id: entry.id, reason: problem });
  }
  return { entries: accepted.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)), rejected };
}

const LOADED = registryLoad();

export function registryEntries(): readonly RegistryEntry[] {
  return LOADED.entries;
}

export function registryEntry(id: string): RegistryEntry | undefined {
  return LOADED.entries.find(entry => entry.id === id);
}

// --- state --------------------------------------------------------------------------------------------------------------

export function initialRegistry(house: LordHouse = DEFAULT_LORD_HOUSE): RegistryState {
  return { occurrences: [], terms: [], nextTerm: 1, house };
}

export function registryOf(state: Pick<GameState, "registry">): RegistryState {
  return state.registry ?? initialRegistry();
}

/** ER-9 API: the player's house — its name and arms. */
export function lordHouse(state: Pick<GameState, "registry">): LordHouse {
  return registryOf(state).house;
}

// --- ER-1 the read model ----------------------------------------------------------------------------------------------

function fieldValue(state: GameState, condition: Extract<RegistryCondition, { field: unknown }>, boundId: string): number | string | boolean | readonly string[] {
  const calendar = stateCalendar(state);
  const stewardship = stewardshipOf(state);
  const estates = estatesOf(state);
  const audit = stewardship.audits.find(entry => entry.id === boundId);
  const steward = audit === undefined ? undefined : stewardship.stewards.find(entry => entry.personId === audit.stewardId);
  const suit = estates.suits.find(entry => entry.id === boundId);
  switch (condition.field) {
    case "market.duesPermille": return state.agency?.duesPermille ?? 1000;
    case "agency.policy": return state.agency?.policy ?? "";
    case "timber.order": return state.timberOrder ?? 0;
    case "steward.rules.amountAtLeast": return stewardship.rules.amountAtLeast ?? -1;
    case "steward.lordDecided": return stewardship.petitions.filter(petition => petition.estateId !== "estate-home" && petition.decidedBy === "lord").length;
    case "bound.revealedKept": return audit?.revealedKept ?? -1;
    case "bound.stewardLoyalty": return steward?.loyalty ?? -1;
    case "bound.stewardConnected": return steward?.connection != null && state.factions?.factions.some(faction => faction.id === steward.connection) === true;
    case "bound.suitStage": return suit?.stage ?? "";
    case "bound.evidence": return suit === undefined ? [] : (estates.claims.find(claim => claim.id === suit.claimId)?.evidence ?? []).map(evidence => evidence.kind);
    case "calendar.year": return calendar.year;
    case "calendar.season": return Math.floor((state.tick % YEAR) / SEASON);
    case "population": return state.population;
    case "treasury": return treasuryBalance(state);
    case "estates.heldOffMap": return heldOffMapEstates(state).length;
    case "estates.delegated": return stewardship.oversight.filter(entry => entry.mode === "steward").length;
    case "estates.direct": return stewardship.oversight.filter(entry => entry.mode === "direct").length;
    case "audit.pending": return pendingAudits(state).length;
    case "suit.open": return estates.suits.filter(suit => suit.stage !== "closed").length;
    case "claim.open": return estates.claims.filter(claim => claim.status === "open").length;
    case "steward.rules.recurring": return stewardship.rules.recurring === true;
    case "attention.overloaded": return attention(state).overloaded;
    case "faction.relation": return state.factions?.factions.find(faction => faction.id === condition.faction)?.relation ?? -1000;
    case "market.exists": return state.buildings.some(building => building.kind === "market");
    case "lord.heirAdult": return (state.persons?.people ?? []).some(person => person.tags.includes("lord-family") && person.role === "child" && calendar.year - person.birthYear >= 16);
    case "marriage.open": return (state.diplomacy?.negotiations ?? []).some(negotiation => negotiation.status === "countered");
  }
  void boundId;
  return false;
}

export function conditionHolds(state: GameState, condition: RegistryCondition | undefined, boundId = ""): boolean {
  if (condition === undefined) return true;
  if ("all" in condition) return condition.all.every(child => conditionHolds(state, child, boundId));
  if ("any" in condition) return condition.any.some(child => conditionHolds(state, child, boundId));
  if ("not" in condition) return !conditionHolds(state, condition.not, boundId);
  const value = fieldValue(state, condition, boundId);
  switch (condition.op) {
    case "eq": return value === condition.value;
    case "ne": return value !== condition.value;
    case "gte": return typeof value === "number" && value >= (condition.value as number);
    case "lte": return typeof value === "number" && value <= (condition.value as number);
    case "in": return (condition.value as readonly (string | number)[]).includes(value as string | number);
    case "has": return Array.isArray(value) && value.includes(condition.value as string);
    case "lacks": return Array.isArray(value) && !value.includes(condition.value as string);
  }
}

// --- ER-1 binding -------------------------------------------------------------------------------------------------------

/** The real instances an entry may bind to now (sorted); [""] for an entry bound to nothing. */
export function boundTargets(state: GameState, entry: RegistryEntry): readonly string[] {
  const estates = estatesOf(state);
  switch (entry.bind) {
    case "none": return [""];
    case "held_estate": return heldOffMapEstates(state).map(estate => estate.id).sort();
    case "delegated_estate": return stewardshipOf(state).oversight.filter(entry => entry.mode === "steward").map(entry => entry.estateId).sort();
    case "pending_audit": return pendingAudits(state).map(audit => audit.id).sort();
    case "open_suit": return estates.suits.filter(suit => suit.stage !== "closed" && suit.stage !== "judged").map(suit => suit.id).sort();
    case "open_claim": return estates.claims.filter(claim => claim.status === "open").map(claim => claim.id).sort();
  }
}

// --- ER-4 effects ------------------------------------------------------------------------------------------------------

/** One effect on the state, or null when the engine refuses it (nothing changed). */
function applyEffect(state: GameState, effect: RegistryEffect, boundId: string, occurrenceId: string): GameState | null {
  const changed = (next: GameState) => (next === state ? null : next);
  const audit = pendingAudits(state).find(entry => entry.id === boundId);
  const estateId = audit?.estateId ?? boundId;
  switch (effect.command) {
    case "none": return state;
    case "set_project_subsidy": return changed(setProjectSubsidy(state, effect.kind as BuildingKind, effect.amount));
    case "set_market_dues": return changed(setMarketDues(state, effect.permille));
    case "set_estate_policy": return changed(setEstatePolicy(state, effect.policy));
    case "set_audit_mode": return changed(setAuditMode(state, estateId, effect.mode));
    case "answer_audit": return changed(answerAudit(state, boundId, effect.choice));
    case "set_estate_oversight": return changed(setEstateOversight(state, estateId, effect.mode));
    case "add_suit_evidence": return changed(addSuitEvidence(state, boundId, effect.evidence));
    case "file_suit": return changed(fileSuit(state, boundId));
    case "order_timber": return changed(orderTimber(state, effect.amount));
    case "faction_relation": {
      // The relation moves through the ledger (history.ts reads the answered occurrence); here only check the faction.
      return state.factions?.factions.some(faction => faction.id === effect.faction) === true ? state : null;
    }
    case "treasury": {
      if (effect.amount < 0 && treasuryBalance(state) < -effect.amount) return null;
      const posted = postLedgerEntries(state, [{ account: "cash", category: "registry_settlement", amount: effect.amount, sourceRefs: [{ type: "actor", id: occurrenceId }] }]);
      return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
    }
    case "term": return startTerm(state, effect, occurrenceId);
    case "rights_scope": return ruleRightsScope(state, boundId, effect.sharePermille);
    case "set_exception_rules": {
      if (state.stewardship === undefined) return null;
      const rules = stewardshipOf(state).rules;
      return changed(setExceptionRules(state, { ...rules, ...(effect.recurring === undefined ? {} : { recurring: effect.recurring }),
        ...(effect.amountAtLeast === undefined ? {} : { amountAtLeast: effect.amountAtLeast }) }));
    }
    case "enforce_possession": return changed(enforcePossession(state, boundId));
  }
}

/** ER-4: a choice's effects in order on a copy — all applied, or none (the state as it was). */
export function applyChoice(state: GameState, entry: RegistryEntry, choiceId: string, boundId: string, occurrenceId: string): GameState | null {
  const choice = entry.choices.find(candidate => candidate.id === choiceId);
  if (choice === undefined || !conditionHolds(state, choice.requires, boundId)) return null;
  let next = state;
  for (const effect of choice.effects) {
    const applied = applyEffect(next, effect, boundId, occurrenceId);
    if (applied === null) return null;
    next = applied;
  }
  return next;
}

/** ER-4: the choices that can be carried out now (each tried on a copy). */
export function enabledChoices(state: GameState, entry: RegistryEntry, boundId: string, occurrenceId: string): readonly string[] {
  return entry.choices.filter(choice => applyChoice(state, entry, choice.id, boundId, occurrenceId) !== null).map(choice => choice.id);
}

// --- ER-7 terms ---------------------------------------------------------------------------------------------------------

function startTerm(state: GameState, effect: Extract<RegistryEffect, { command: "term" }>, source: string): GameState | null {
  if (effect.years < 1 || effect.amountPerYear < 0) return null;
  const registry = registryOf(state);
  // A remission of the market dues: the dues fall to `amountPerYear` (permille, the lord's lowest is 250‰) now; the term
  // restores the dues it found at its end.
  let next = state;
  let restore: number | undefined;
  if (effect.term === "remission" && effect.what === "market_dues") {
    restore = state.agency?.duesPermille;
    next = setMarketDues(state, effect.amountPerYear);
    if (next === state || restore === undefined) return null;
  }
  const term: RegistryTerm = { id: `term-${registry.nextTerm}`, kind: effect.term, what: effect.what, amountPerYear: effect.amountPerYear, years: effect.years,
    startTick: state.tick, endTick: state.tick + effect.years * YEAR, source, settledYears: 0, ...(restore === undefined ? {} : { restore }), status: "running" };
  return { ...next, registry: { ...registryOf(next), terms: [...registryOf(next).terms, term], nextTerm: registry.nextTerm + 1 } };
}

/** ER-7: at each year's turn the running terms settle a year (an instalment paid, a remission taken); at their end they stop. */
function settleTerms(state: GameState): GameState {
  const registry = registryOf(state);
  if (!registry.terms.some(term => term.status === "running")) return state;
  let next = state;
  const terms = registry.terms.map(term => {
    if (term.status !== "running") return term;
    const due = Math.floor((state.tick - term.startTick) / YEAR);
    let settled = term;
    if (due > term.settledYears && term.kind === "installments") {
      const posted = postLedgerEntries(next, [{ account: "cash", category: "instalment", amount: -term.amountPerYear, sourceRefs: [{ type: "actor", id: term.source }, { type: "actor", id: term.id }] }]);
      next = { ...next, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
    }
    if (due > term.settledYears) settled = { ...settled, settledYears: due };
    if (state.tick >= term.endTick) {
      if (term.kind === "remission" && term.what === "market_dues" && term.restore !== undefined) next = setMarketDues(next, term.restore);
      settled = { ...settled, status: "ended" };
    }
    return settled;
  });
  return { ...next, registry: { ...registryOf(next), terms } };
}

// --- ER-8 rights scope --------------------------------------------------------------------------------------------------

function ruleRightsScope(state: GameState, suitId: string, sharePermille: number): GameState | null {
  const estates = estatesOf(state);
  const suit = estates.suits.find(entry => entry.id === suitId);
  if (suit === undefined || suit.pieceId === undefined || sharePermille < 0 || sharePermille > 2000) return null;
  let found = false;
  const updated = estates.estates.map(estate => estate.id !== suit.estateId ? estate : { ...estate, pieces: estate.pieces.map(piece => {
    if (piece.id !== suit.pieceId) return piece;
    found = true;
    return { ...piece, scope: { sharePermille, ruledTick: state.tick, suitId } };
  }) });
  return found ? { ...state, estates: { ...estates, estates: updated } } : null;
}

// --- ER-3 the season's draw ---------------------------------------------------------------------------------------------

const seasonIndexOf = (tick: number) => Math.floor(tick / SEASON);

function lapseOffers(state: GameState): GameState {
  const registry = registryOf(state);
  const due = registry.occurrences.filter(entry => entry.status === "offered" && state.tick > entry.deadline);
  if (due.length === 0) return state;
  let next = state;
  const occurrences = registry.occurrences.map(occurrence => {
    if (!due.includes(occurrence)) return occurrence;
    const entry = registryEntry(occurrence.entryId);
    if (entry?.lapseChoice !== undefined) {
      const applied = applyChoice(next, entry, entry.lapseChoice, occurrence.boundId, occurrence.id);
      if (applied !== null) next = applied;
    }
    return { ...occurrence, status: "lapsed" as const, settledTick: state.tick, ...(entry?.lapseChoice === undefined ? {} : { choiceId: entry.lapseChoice }) };
  });
  return { ...next, registry: { ...registryOf(next), occurrences } };
}

/** ER-3: the season's candidates in order, each with its draw; the chosen ones within the budget. */
export function seasonDraw(state: GameState): readonly { readonly entry: RegistryEntry; readonly boundId: string; readonly draw: number; readonly conditions: readonly string[] }[] {
  const registry = registryOf(state);
  const year = stateCalendar(state).year;
  const season = Math.floor((state.tick % YEAR) / SEASON);
  const index = seasonIndexOf(state.tick);
  const thisYear = registry.occurrences.filter(entry => Math.floor(entry.offeredTick / YEAR) === Math.floor(state.tick / YEAR));
  const candidates: { entry: RegistryEntry; boundId: string; draw: number; conditions: readonly string[] }[] = [];
  for (const entry of registryEntries()) {
    if (entry.generator !== undefined || entry.kind === "annual_rule") continue;
    if (year < entry.window.fromYear || year > entry.window.toYear) continue;
    if (entry.seasons !== undefined && !entry.seasons.includes(season)) continue;
    const past = registry.occurrences.filter(occurrence => occurrence.entryId === entry.id);
    if (past.length >= entry.recurrence.maxOccurrences) continue;
    if (past.filter(occurrence => thisYear.includes(occurrence)).length >= entry.frequency.maxPerYear) continue;
    const last = past.at(-1);
    const gap = Math.max(entry.frequency.minGapSeasons, entry.recurrence.mode === "cooldown" ? entry.recurrence.cooldownSeasons : 0);
    if (last !== undefined && index - seasonIndexOf(last.offeredTick) < gap) continue;
    for (const boundId of boundTargets(state, entry)) {
      if (entry.recurrence.mode === "once_per_target" && past.some(occurrence => occurrence.boundId === boundId)) continue;
      if (!conditionHolds(state, entry.conditions, boundId)) continue;
      // An open offer on the same target is not dressed again as another card.
      if (registry.occurrences.some(occurrence => occurrence.status === "offered" && occurrence.boundId !== "" && occurrence.boundId === boundId)) continue;
      const draw = hashSeed(state.seed, `registry:${entry.id}:${boundId}`, index) % 1000;
      if (draw >= entry.frequency.chancePermille) continue;
      candidates.push({ entry, boundId, draw, conditions: entry.conditions === undefined ? [] : [JSON.stringify(entry.conditions)] });
    }
  }
  // Conflicts: one per exclusive group and one per target (the heavier, then the id).
  const byWeight = [...candidates].sort((left, right) => right.entry.frequency.weight - left.entry.frequency.weight || (left.entry.id < right.entry.id ? -1 : 1));
  const groups = new Set<string>(), targets = new Set<string>();
  const kept = byWeight.filter(candidate => {
    if (candidate.entry.exclusiveGroup !== undefined) { if (groups.has(candidate.entry.exclusiveGroup)) return false; groups.add(candidate.entry.exclusiveGroup); }
    if (candidate.boundId !== "") { if (targets.has(candidate.boundId)) return false; targets.add(candidate.boundId); }
    return true;
  });
  const left = Math.min(REGISTRY_EVENTS_PER_SEASON, REGISTRY_EVENTS_PER_YEAR - thisYear.filter(entry => !entry.entryId.startsWith("home:")).length);
  if (left <= 0 || kept.length === 0) return [];
  // The weighted draw among the kept (a separate name for the selection).
  const total = kept.reduce((sum, candidate) => sum + candidate.entry.frequency.weight, 0);
  let pick = hashSeed(state.seed, "registry-selection", index) % total;
  const ordered = [...kept].sort((left, right) => (left.entry.id < right.entry.id ? -1 : left.entry.id > right.entry.id ? 1 : left.boundId < right.boundId ? -1 : 1));
  for (const candidate of ordered) {
    if (pick < candidate.entry.frequency.weight) return [candidate];
    pick -= candidate.entry.frequency.weight;
  }
  return [];
}

function offerSeason(state: GameState): GameState {
  const chosen = seasonDraw(state);
  if (chosen.length === 0) return state;
  const registry = registryOf(state);
  const offers: RegistryOccurrence[] = [];
  for (const candidate of chosen) {
    const id = `registry:${candidate.entry.id}:${candidate.boundId}:${seasonIndexOf(state.tick)}`;
    // ER-4: an entry with fewer than two choices that can be carried out now is not offered.
    if (enabledChoices(state, candidate.entry, candidate.boundId, id).length < 2) continue;
    offers.push({ id, entryId: candidate.entry.id, boundId: candidate.boundId, offeredTick: state.tick, deadline: state.tick + REGISTRY_ANSWER_TICKS,
      status: "offered", receipt: { draw: candidate.draw, chancePermille: candidate.entry.frequency.chancePermille, conditions: candidate.conditions } });
  }
  if (offers.length === 0) return state;
  return { ...state, registry: { ...registry, occurrences: [...registry.occurrences, ...offers].slice(-MAX_OCCURRENCES_KEPT) } };
}

/** LM-E9: the registry's step (lord mode only) — at a season's start: terms at the year's turn, lapses, the season's offer. */
export function advanceRegistry(state: GameState): GameState {
  if (state.agency === undefined || state.tick <= 0 || state.tick % SEASON !== 0) return state;
  let next = state;
  if (state.tick % YEAR === 0) next = settleTerms(next);
  next = lapseOffers(next);
  next = offerSeason(next);
  return next;
}

// --- ER-4 answers -------------------------------------------------------------------------------------------------------

export function openRegistryOffers(state: GameState): readonly RegistryOccurrence[] {
  return registryOf(state).occurrences.filter(occurrence => occurrence.status === "offered" && state.tick <= occurrence.deadline);
}

/** ER-4 API: the lord answers an offer — rechecked now, applied whole or not at all; a second answer is refused. */
export function answerRegistryOffer(state: GameState, occurrenceId: string, choiceId: string): GameState {
  const occurrence = openRegistryOffers(state).find(entry => entry.id === occurrenceId);
  const entry = occurrence === undefined ? undefined : registryEntry(occurrence.entryId);
  if (occurrence === undefined || entry === undefined) return state;
  if (!boundTargets(state, entry).includes(occurrence.boundId) || !conditionHolds(state, entry.conditions, occurrence.boundId)) {
    const registry = registryOf(state);
    return { ...state, registry: { ...registry, occurrences: registry.occurrences.map(item => item.id === occurrenceId ? { ...item, status: "invalid" as const, settledTick: state.tick } : item) } };
  }
  const applied = applyChoice(state, entry, choiceId, occurrence.boundId, occurrence.id);
  if (applied === null) return state;
  const registry = registryOf(applied);
  return { ...applied, registry: { ...registry, occurrences: registry.occurrences.map(item => item.id === occurrenceId
    ? { ...item, status: "answered" as const, choiceId, settledTick: state.tick } : item) } };
}

/** ER-9: a lord-mode game's registry with the player's house (the new game's option). */
export function withLordHouse(state: GameState, house: LordHouse): GameState {
  return { ...state, registry: { ...registryOf(state), house } };
}

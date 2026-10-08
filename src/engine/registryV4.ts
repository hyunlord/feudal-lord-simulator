import { prepareRegistryChapterPetition, registryChapterPetitionContext, registryChapterPetitionDef } from "./registryChapterPetitions";
/**
 * LM-E9b (spec docs/design/registry.md ER-13…ER-18): the content canon v4 in the registry — its entries loaded and
 * checked (what runs, what is blocked and why), their targets bound (the first combination for which the entry's
 * conditions hold, R2), their choices' commands resolved and sent to the engine's own handlers, each command checked to
 * have done what it was asked (ER-16), and the season's candidates. Lord mode only (the registry runs with `agency`).
 */
import type { BuildingKind } from "../content/buildingConfig";
import { HOLD_CLAIM_WEAKEN, HOLD_RELATION_DELTA } from "../content/registry/registryHoldConfig";
import { V4_SENDER_FACTION } from "../content/registry/registryHoldCopy.ko";
import { V4_COPY } from "../content/registry/v4Copy.generated";
import { handlesPetitionContext } from "../content/registry/petitionContextConfig";
import { V4_BLOCKED_ENTRIES, V4_LIVE_ENTRIES } from "../content/registry/v4Entries.generated";
import { V4_HELD_ENTRIES } from "../content/registry/v4Holds.generated";
import { TOO_FEW_CHOICES_LEFT, V4_HELD_CHOICES } from "../content/registry/registryHeldChoices.ko";
import type { GameState } from "./engine.types";
import { estatesOf, LORD } from "./estates";
import { addSuitEvidence, enforcePossession, fileSuit, seekSuitPatron } from "./estateSuits";
import { answerCounter, keepPromise, proposeMarriage } from "./marriage";
import { diplomacyOf } from "./negotiation";
import { famineResponse, respondToPetition } from "./politics";
import { hashSeed } from "./prng";
import { evaluate, expressionProblem, holds, MISSING, type Scope } from "./registryDsl";
import { readContextSnapshot } from "./registryContextSnapshot";
import { petitionContext } from "./registryPetitionContext";
import { stateCalendar } from "./scenarioState";
import { answerAudit, answerEstatePetition, setAuditMode, setEstateOversight, setExceptionRules, stewardshipOf } from "./stewardship";
import { orderTimber } from "./timberTrade";
import { setEstatePolicy, setMarketDues, setProjectSubsidy } from "./townAgency";

const SEASON = 1_000;
const YEAR = 4_000;
/** ER-15: the most target combinations tried for one entry in one draw (beyond it the entry waits for a later season). */
const MAX_COMBINATIONS = 64;

// --- ER-13 the entries ----------------------------------------------------------------------------------------------------

interface V4Order { readonly field: string; readonly direction?: "asc" | "desc"; readonly collation?: string }
export interface V4Binding { readonly from: unknown; readonly where?: unknown; readonly order?: readonly V4Order[]; readonly requiredForChoices?: readonly string[] }
export interface V4Command { readonly type: string; readonly args?: Readonly<Record<string, unknown>> }
export interface V4Choice {
  readonly id: string;
  readonly commands: readonly V4Command[];
  readonly execution: string;
  readonly conditions?: { readonly ast?: unknown; readonly bindingFailures?: string };
}
export interface V4Entry {
  readonly id: string;
  readonly contentClass: "new_event_draft" | "existing_petition_variant" | "existing_event_copy_revision";
  readonly calendar: { readonly yearMinInclusive: number; readonly yearMaxInclusive: number; readonly seasonIndices: readonly number[] };
  readonly frequency: { readonly mode: string; readonly maxPerYear: number; readonly minGapSeasons: number; readonly weight: number; readonly chancePermille: number };
  readonly recurrence: { readonly mode: "once_per_campaign" | "new_context_only"; readonly cooldownSeasonsMinimum?: number; readonly contextFields?: readonly string[] };
  readonly dedup: { readonly group?: string; readonly semanticFields?: readonly string[]; readonly suppressWhileBoundOpen?: boolean };
  readonly bindings: Readonly<Record<string, V4Binding>>;
  readonly conditions?: unknown;
  readonly choices: readonly V4Choice[];
  readonly minimumEnabledConsequentialChoices: number;
}

const ENTRIES = V4_LIVE_ENTRIES as readonly V4Entry[];
const BY_ID = new Map(ENTRIES.map(entry => [entry.id, entry]));
export const v4Entry = (id: string): V4Entry | undefined => BY_ID.get(id);
export const v4Entries = (): readonly V4Entry[] => ENTRIES;

// --- ER-16 commands -------------------------------------------------------------------------------------------------------

type Args = Readonly<Record<string, unknown>>;
interface Dispatch { readonly run: (state: GameState, args: Args) => GameState; readonly did: (after: GameState, before: GameState, args: Args) => boolean }
const str = (value: unknown) => (typeof value === "string" ? value : "");
const lordSuit = (state: GameState, suitId: unknown) => estatesOf(state).suits.some(suit => suit.id === suitId && suit.plaintiff === LORD);
const oversightOf = (state: GameState, estateId: unknown) => stewardshipOf(state).oversight.find(entry => entry.estateId === estateId);

/** ER-16: each command the canon uses (COMMAND_CONTRACT), its engine handler and the check that it did what was asked. */
export const V4_COMMANDS: Readonly<Record<string, Dispatch>> = {
  set_estate_policy: { run: (state, args) => setEstatePolicy(state, args.policy as Parameters<typeof setEstatePolicy>[1]), did: (after, _, args) => after.agency?.policy === args.policy },
  set_project_subsidy: { run: (state, args) => setProjectSubsidy(state, args.kind as BuildingKind, Number(args.amount)),
    did: (after, _, args) => Number(args.amount) === 0 ? !(after.agency?.subsidies ?? []).some(subsidy => subsidy.kind === args.kind)
      : (after.agency?.subsidies ?? []).some(subsidy => subsidy.kind === args.kind && subsidy.amount === Number(args.amount)) },
  set_market_dues: { run: (state, args) => setMarketDues(state, Number(args.permille)), did: (after, _, args) => after.agency?.duesPermille === Number(args.permille) },
  order_timber: { run: (state, args) => orderTimber(state, Number(args.amount)), did: (after, before) => (after.timberOrder ?? 0) !== (before.timberOrder ?? 0) },
  file_suit: { run: (state, args) => (estatesOf(state).claims.find(claim => claim.id === args.claimId)?.claimant === LORD ? fileSuit(state, str(args.claimId)) : state),
    did: (after, _, args) => estatesOf(after).suits.some(suit => suit.claimId === args.claimId) },
  add_suit_evidence: { run: (state, args) => (lordSuit(state, args.suitId) ? addSuitEvidence(state, str(args.suitId), args.evidence as Parameters<typeof addSuitEvidence>[2]) : state),
    did: (after, before, args) => {
      const suit = estatesOf(after).suits.find(entry => entry.id === args.suitId);
      // DEC-TRACE (P-D1): the evidence is new — a choice that hands in what the court already has does nothing.
      const has = (state: GameState) => estatesOf(state).claims.find(claim => claim.id === suit?.claimId)?.evidence.filter(entry => entry.kind === args.evidence).length ?? 0;
      return has(after) > has(before);
    } },
  seek_suit_patron: { run: (state, args) => (lordSuit(state, args.suitId) ? seekSuitPatron(state, str(args.suitId), str(args.factionId)) : state),
    did: (after, _, args) => estatesOf(after).suits.find(suit => suit.id === args.suitId)?.patron === args.factionId },
  enforce_possession: { run: (state, args) => (lordSuit(state, args.suitId) ? enforcePossession(state, str(args.suitId)) : state),
    did: (after, before, args) => (estatesOf(after).suits.find(suit => suit.id === args.suitId)?.enforcements ?? 0) > (estatesOf(before).suits.find(suit => suit.id === args.suitId)?.enforcements ?? 0) },
  propose_marriage: { run: (state, args) => proposeMarriage(state, args.terms as Parameters<typeof proposeMarriage>[1], args.groomId as string | undefined),
    did: (after, before) => diplomacyOf(after).negotiations.length > diplomacyOf(before).negotiations.length },
  answer_counter: { run: (state, args) => answerCounter(state, str(args.negotiationId), args.accept === true),
    did: (after, _, args) => diplomacyOf(after).negotiations.find(entry => entry.id === args.negotiationId)?.status !== "countered" },
  keep_promise: { run: (state, args) => keepPromise(state, str(args.promiseId)),
    did: (after, _, args) => diplomacyOf(after).promises.find(entry => entry.id === args.promiseId)?.status === "kept" },
  set_estate_oversight: { run: (state, args) => setEstateOversight(state, str(args.estateId), args.mode as "direct" | "steward", args.stewardId as string | undefined),
    did: (after, _, args) => {
      const oversight = oversightOf(after, args.estateId);
      return oversight !== undefined && oversight.mode === args.mode && (args.stewardId === undefined || oversight.stewardId === args.stewardId);
    } },
  set_exception_rules: { run: (state, args) => setExceptionRules(state, args.rules as Parameters<typeof setExceptionRules>[1]),
    did: (after, _, args) => JSON.stringify(stewardshipOf(after).rules) === JSON.stringify(args.rules) },
  answer_estate_petition: { run: (state, args) => answerEstatePetition(state, str(args.petitionId), args.grant === true),
    did: (after, _, args) => stewardshipOf(after).petitions.find(petition => petition.id === args.petitionId)?.status !== "open" },
  set_audit_mode: { run: (state, args) => setAuditMode(state, str(args.estateId), args.mode as "accounts" | "visit"), did: (after, _, args) => oversightOf(after, args.estateId)?.auditMode === args.mode },
  answer_audit: { run: (state, args) => answerAudit(state, str(args.auditId), args.choice as "punish" | "replace" | "tolerate", false, args.replacementId as string | undefined),
    did: (after, _, args) => stewardshipOf(after).audits.find(audit => audit.id === args.auditId)?.status !== "pending" },
  famine_response: { run: (state, args) => famineResponse(state, args.choice as Parameters<typeof famineResponse>[1]), did: (after, before) => after !== before },
  petition_response: { run: (state, args) => respondToPetition(state, str(args.petitionId), args.response as Parameters<typeof respondToPetition>[2]),
    did: (after, _, args) => after.politics?.petitions.find(petition => petition.id === args.petitionId)?.response === args.response },
};

/** ER-16: a command's arguments with each `{binding}` resolved once (null when one is missing). */
function resolveArgs(value: unknown, scope: Scope): unknown {
  if (Array.isArray(value)) {
    const items = value.map(item => resolveArgs(item, scope));
    return items.includes(MISSING) ? MISSING : items;
  }
  if (typeof value === "object" && value !== null) {
    if ("binding" in value) return evaluate(value, scope);
    const entries = Object.entries(value).map(([key, inner]) => [key, resolveArgs(inner, scope)] as const);
    return entries.some(([, inner]) => inner === MISSING) ? MISSING : Object.fromEntries(entries);
  }
  return value;
}

/** ER-16 (R4): what a command leaves for the next one in the same choice (`result.previousCommand`): its arguments, and a filed suit's id. */
function commandResult(command: V4Command, args: Args, before: GameState, after: GameState): Readonly<Record<string, unknown>> {
  if (command.type === "file_suit") {
    const suit = estatesOf(after).suits.find(entry => entry.claimId === args.claimId && !estatesOf(before).suits.some(old => old.id === entry.id));
    return { ...args, ...(suit === undefined ? {} : { suitId: suit.id }) };
  }
  return args;
}

/**
 * ER-16, R4: a choice's commands in order on a copy — all done as asked, or none (null). A compound choice is atomic this
 * way: each command is checked to have done what it was asked, and a later one may read the previous one's result.
 */
export function runCommands(state: GameState, commands: readonly V4Command[], scope: Scope): GameState | null {
  let next = state;
  let previous: Readonly<Record<string, unknown>> | undefined;
  for (const command of commands) {
    const dispatch = V4_COMMANDS[command.type];
    const vars = previous === undefined ? scope.vars : { ...scope.vars, result: { previousCommand: previous } };
    const args = resolveArgs(command.args ?? {}, { ...scope, state: next, vars });
    if (dispatch === undefined || args === MISSING) return null;
    const after = dispatch.run(next, args as Args);
    if (after === next || !dispatch.did(after, next, args as Args)) return null;
    previous = commandResult(command, args as Args, next, after);
    next = after;
  }
  return next;
}

// --- ER-19 holds (R3) -------------------------------------------------------------------------------------------------------

/** ER-19: what holding costs on this entry — its claim weakens, its promise or negotiation runs on, or its sender's relation falls (null: no cost, the hold is hidden). */
/** DEC-TRACE: the faction an entry's sender speaks for (the canon's sender role), or undefined. */
export const v4SenderFaction = (entryId: string): string | undefined => V4_SENDER_FACTION[V4_COPY[entryId]?.senderFaction ?? ""];

export type HoldCost = { readonly kind: "claim" } | { readonly kind: "deadline"; readonly binding: string } | { readonly kind: "relation"; readonly faction: string };
export function holdCost(entry: V4Entry): HoldCost | null {
  const names = Object.keys(entry.bindings);
  if (names.includes("claim") || names.includes("suit")) return { kind: "claim" };
  const deadline = names.find(name => name === "promise" || name === "negotiation");
  if (deadline !== undefined) return { kind: "deadline", binding: deadline };
  const faction = V4_SENDER_FACTION[V4_COPY[entry.id]?.senderFaction ?? ""];
  return faction === undefined ? null : { kind: "relation", faction };
}

function heldClaimId(state: GameState, bound: Readonly<Record<string, unknown>>): string | null {
  const claim = bound.claim as { id?: unknown } | undefined;
  if (typeof claim?.id === "string") return claim.id;
  const suit = bound.suit as { claimId?: unknown } | undefined;
  return typeof suit?.claimId === "string" && estatesOf(state).claims.some(entry => entry.id === suit.claimId) ? suit.claimId : null;
}

/** ER-19: a hold applied — the claim weakened now (the relation is moved by the history from the occurrence's record). */
export function applyHold(state: GameState, entry: V4Entry, bound: Readonly<Record<string, unknown>>): { readonly state: GameState; readonly hold: NonNullable<import("./registry.types").RegistryOccurrence["hold"]> } | null {
  const cost = holdCost(entry);
  if (cost === null) return null;
  if (cost.kind === "claim") {
    const claimId = heldClaimId(state, bound);
    if (claimId === null) return null;
    const estates = estatesOf(state);
    const claims = estates.claims.map(claim => claim.id === claimId ? { ...claim, strength: Math.max(0, claim.strength - HOLD_CLAIM_WEAKEN) } : claim);
    return { state: { ...state, estates: { ...estates, claims } }, hold: { claimId, weakened: HOLD_CLAIM_WEAKEN } };
  }
  if (cost.kind === "deadline") return bound[cost.binding] === undefined ? null : { state, hold: { deadline: itemIdentity(bound[cost.binding]) } };
  return state.factions?.factions.some(faction => faction.id === cost.faction) === true ? { state, hold: { faction: cost.faction, delta: HOLD_RELATION_DELTA } } : null;
}

// --- ER-17 support ---------------------------------------------------------------------------------------------------------

export interface V4ChoiceSupport { readonly id: string; readonly supported: boolean; readonly reason: string | null }
export interface V4EntrySupport { readonly id: string; readonly contentClass: string; readonly runs: boolean; readonly reason: string | null; readonly choices: readonly V4ChoiceSupport[] }

/** DEC-TRACE: the v4.2 audit's held events and the choices held after it (their reasons kept as data). */
const HELD_ENTRIES: ReadonlyMap<string, string> = new Map(V4_HELD_ENTRIES.map(entry => [entry.id, `held (v4.2 audit, ${entry.effectClass}): ${entry.reason}`]));
const HELD_CHOICES: ReadonlyMap<string, string> = new Map(V4_HELD_CHOICES.map(entry => [`${entry.entry}:${entry.choice}`, `held (DEC-TRACE): ${entry.reason}`]));

function choiceSupport(entry: V4Entry, choice: V4Choice): V4ChoiceSupport {
  const held = HELD_CHOICES.get(`${entry.id}:${choice.id}`);
  if (held !== undefined) return { id: choice.id, supported: false, reason: held };
  if (choice.execution === "blocked_unsupported_effect") return { id: choice.id, supported: false, reason: "new effect (R5)" };
  // R4: a compound choice runs through `runCommands`, which is atomic (blocked_until_atomic_adapter is lifted here).
  if (choice.commands.length === 0 && holdCost(entry) === null) return { id: choice.id, supported: false, reason: "hold without a time cost (R3)" };
  const unknown = choice.commands.find(command => V4_COMMANDS[command.type] === undefined);
  if (unknown !== undefined) return { id: choice.id, supported: false, reason: `command ${unknown.type}` };
  const problem = expressionProblem([choice.conditions?.ast, choice.commands]);
  return problem === null ? { id: choice.id, supported: true, reason: null } : { id: choice.id, supported: false, reason: problem };
}

function entrySupport(entry: V4Entry): V4EntrySupport {
  const choices = entry.choices.map(choice => choiceSupport(entry, choice));
  const problem = expressionProblem([entry.bindings, entry.conditions]);
  const supported = choices.filter(choice => choice.supported).length;
  const heldChoices = entry.choices.some(choice => HELD_CHOICES.has(`${entry.id}:${choice.id}`));
  const reason = HELD_ENTRIES.get(entry.id) ?? (entry.contentClass !== "new_event_draft" ? "a variant of an existing occurrence's words (ER-13), not drawn"
    : problem !== null ? problem
    // DEC-TRACE: an event its held choices leave with fewer than two is held whole.
    : heldChoices && supported < 2 ? `held (DEC-TRACE): ${TOO_FEW_CHOICES_LEFT}`
    : supported < entry.minimumEnabledConsequentialChoices ? `${supported} supported choice(s), ${entry.minimumEnabledConsequentialChoices} needed` : null);
  return { id: entry.id, contentClass: entry.contentClass, runs: reason === null, reason, choices };
}

const SUPPORT = new Map(ENTRIES.map(entry => [entry.id, entrySupport(entry)]));

/** ER-18 API: every v4 entry — whether it runs and why not, and each choice. The canon's blocked ones carry their filters. */
export function registryV4Support(): readonly V4EntrySupport[] {
  return [...SUPPORT.values(), ...V4_BLOCKED_ENTRIES.map(entry => ({ id: entry.id, contentClass: entry.contentClass, runs: false,
    reason: `unsupported filter: ${entry.blockedBy.join(", ")}`, choices: [] }))].sort((left, right) => (left.id < right.id ? -1 : 1));
}

// --- ER-15 binding -----------------------------------------------------------------------------------------------------------

/** A bound item's identity (to keep it across the season's draw and the answer, and in the dedup key). */
export function itemIdentity(item: unknown): string {
  if (typeof item !== "object" || item === null) return String(item);
  const record = item as Record<string, unknown>;
  for (const key of ["id", "personId", "estateId"]) { const value = record[key]; if (typeof value === "string") return value; }
  const person = record.person;
  if (typeof person === "object" && person !== null) { const id = (person as Record<string, unknown>).id; if (typeof id === "string") return id; }
  return JSON.stringify(item);
}

function dependsOn(binding: V4Binding): readonly string[] {
  const names = new Set<string>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (typeof value !== "object" || value === null) return;
    for (const [key, inner] of Object.entries(value)) {
      if ((key === "field" || key === "binding") && typeof inner === "string" && inner.startsWith("bound.")) names.add(inner.split(".")[1]!);
      walk(inner);
    }
  };
  walk([binding.from, binding.where]);
  return [...names];
}

function bindingOrder(entry: V4Entry): readonly string[] {
  const names = Object.keys(entry.bindings);
  const done: string[] = [];
  const visit = (name: string, path: readonly string[]) => {
    if (done.includes(name) || path.includes(name)) return;
    for (const dependency of dependsOn(entry.bindings[name]!)) if (names.includes(dependency)) visit(dependency, [...path, name]);
    done.push(name);
  };
  for (const name of [...names].sort()) visit(name, []);
  return done;
}

const codepoint = (left: unknown, right: unknown) => (typeof left === "number" && typeof right === "number" ? left - right : String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0);

function candidates(binding: V4Binding, scope: Scope): readonly unknown[] {
  const from = evaluate(binding.from, scope);
  if (!Array.isArray(from)) return [];
  const kept = from.filter(item => holds(binding.where, { ...scope, vars: { ...scope.vars, item } }));
  const order = binding.order ?? [];
  return [...kept].sort((left, right) => {
    for (const rule of order) {
      const a = evaluate({ field: `item.${rule.field}` }, { ...scope, vars: { item: left } });
      const b = evaluate({ field: `item.${rule.field}` }, { ...scope, vars: { item: right } });
      const by = codepoint(a, b) * (rule.direction === "desc" ? -1 : 1);
      if (by !== 0) return by;
    }
    return 0;
  });
}

/**
 * ER-15 (R2): the entry's targets — the first combination, in the bindings' order and each binding's own order, for which
 * the entry's conditions hold (not the first item of each binding alone). `fixed` keeps the identities an offer bound.
 * Bindings needed only by some choices (`requiredForChoices`) are bound afterwards, first match, and may stay missing.
 */
export function bindEntry(state: GameState, entry: V4Entry, fixed?: Readonly<Record<string, string>>): Readonly<Record<string, unknown>> | null {
  if (registryChapterPetitionDef(entry.id) !== undefined && !registryChapterPetitionContext(state, entry.id)) return null;
  const contextualEntry = handlesPetitionContext(entry.id);
  const savedContext = fixed === undefined || !contextualEntry ? undefined : readContextSnapshot(fixed.authoredContext);
  if (savedContext === null) return null;
  const order = bindingOrder(entry);
  const entryLevel = order.filter(name => entry.bindings[name]!.requiredForChoices === undefined);
  const choiceLevel = order.filter(name => entry.bindings[name]!.requiredForChoices !== undefined);
  let tries = 0;
  const assign = (index: number, bound: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | null => {
    if (index === entryLevel.length) {
      tries += 1;
      let contextual = bound;
      if (contextualEntry) {
        const authoredContext = petitionContext(state, entry.id, bound, savedContext);
        if (authoredContext === null) return null;
        contextual = { ...bound, authoredContext };
      }
      return holds(entry.conditions, { state, bound: contextual, vars: {} }) ? contextual : null;
    }
    const name = entryLevel[index]!;
    for (const item of candidates(entry.bindings[name]!, { state, bound, vars: {} })) {
      if (fixed?.[name] !== undefined && itemIdentity(item) !== fixed[name]) continue;
      const found = assign(index + 1, { ...bound, [name]: item });
      if (found !== null || tries >= MAX_COMBINATIONS) return found;
    }
    return null;
  };
  const bound = assign(0, {});
  if (bound === null) return null;
  let all = bound;
  for (const name of choiceLevel) {
    const item = candidates(entry.bindings[name]!, { state, bound: all, vars: {} }).find(candidate => fixed?.[name] === undefined || itemIdentity(candidate) === fixed[name]);
    if (item !== undefined) all = { ...all, [name]: item };
  }
  return all;
}

/** ER-17: the choices that can be carried out now on these targets (each tried on a copy). */
export function v4EnabledChoices(state: GameState, entry: V4Entry, bound: Readonly<Record<string, unknown>>): readonly string[] {
  const support = SUPPORT.get(entry.id);
  return entry.choices.filter(choice => {
    if (support?.choices.find(item => item.id === choice.id)?.supported !== true) return false;
    const scoped = Object.entries(entry.bindings).filter(([, binding]) => binding.requiredForChoices?.includes(choice.id) === true);
    if (scoped.some(([name]) => bound[name] === undefined)) return false;
    const scope: Scope = { state, bound, vars: {} };
    if (!holds(choice.conditions?.ast, scope)) return false;
    return choice.commands.length === 0 ? applyHold(state, entry, bound) !== null : runCommands(state, choice.commands, scope) !== null;
  }).map(choice => choice.id);
}

/** The identities of the bound targets (what an offer keeps). */
export const boundIdentities = (bound: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(bound).map(([name, item]) => [name, itemIdentity(item)]));

/** ER-15: the dedup key of an entry on its targets (its group and the semantic fields' values), or the entry's own id. */
export function dedupKey(entry: V4Entry, bound: Readonly<Record<string, unknown>>): string {
  const fields = entry.dedup.semanticFields ?? [];
  const values = fields.map(field => {
    const value = evaluate({ field }, { state: {} as GameState, bound, vars: {} });
    return value === MISSING ? "" : itemIdentity(value);
  });
  return `${entry.dedup.group ?? entry.id}|${values.join("|")}`;
}

/** The context key of a `new_context_only` entry (its context fields' values). */
export function contextKey(entry: V4Entry, bound: Readonly<Record<string, unknown>>): string {
  return (entry.recurrence.contextFields ?? []).map(field => {
    const value = evaluate({ field }, { state: {} as GameState, bound, vars: {} });
    return value === MISSING ? "" : itemIdentity(value);
  }).join("|");
}

// --- ER-3 the season's candidates ----------------------------------------------------------------------------------------

export interface V4Candidate {
  readonly entry: V4Entry;
  readonly bound: Readonly<Record<string, unknown>>;
  readonly draw: number;
  readonly key: string;
  readonly context: string;
}

export interface V4Past { readonly entryId: string; readonly offeredTick: number; readonly status: string; readonly key?: string; readonly context?: string }

/** ER-3, ER-15, ER-17: this season's v4 candidates (in their window and seasons, not repeated or open on the same key, drawn under their chance, bound, with two choices that can be carried out). */
/**
 * ER-22 (the user's decision 2026-10-05): this season's chance, permille, that a one-shot entry (`once_per_campaign`) may
 * be offered — the one-shot entries not yet offered whose windows are still open, over the seasons left until those
 * windows end. Many left: often; few: rarely — spread to the end of the windows.
 */
export function oneShotPacePermille(state: GameState, past: readonly V4Past[]): number {
  const { year, season } = stateCalendar(state);
  const left = ENTRIES.filter(entry => SUPPORT.get(entry.id)?.runs === true && entry.recurrence.mode === "once_per_campaign"
    && entry.calendar.yearMaxInclusive >= year && !past.some(occurrence => occurrence.entryId === entry.id));
  if (left.length === 0) return 0;
  const end = Math.max(...left.map(entry => entry.calendar.yearMaxInclusive));
  const seasons = (end - year) * 4 + (4 - season);
  return Math.min(1000, Math.floor(1000 * left.length / Math.max(1, seasons)));
}

export function v4Candidates(state: GameState, past: readonly V4Past[]): readonly V4Candidate[] {
  const { year, season } = stateCalendar(state);
  const index = Math.floor(state.tick / SEASON);
  const thisYear = past.filter(occurrence => Math.floor(occurrence.offeredTick / YEAR) === Math.floor(state.tick / YEAR));
  // ER-22: one-shot entries come this season only under the pace's draw.
  const oneShotsOpen = hashSeed(state.seed, "registry-pace", index) % 1000 < oneShotPacePermille(state, past);
  const out: V4Candidate[] = [];
  for (const entry of ENTRIES) {
    if (SUPPORT.get(entry.id)?.runs !== true) continue;
    if (year < entry.calendar.yearMinInclusive || year > entry.calendar.yearMaxInclusive || !entry.calendar.seasonIndices.includes(season)) continue;
    const own = past.filter(occurrence => occurrence.entryId === entry.id);
    if (entry.recurrence.mode === "once_per_campaign" && (own.length > 0 || !oneShotsOpen)) continue;
    if (own.filter(occurrence => thisYear.includes(occurrence)).length >= entry.frequency.maxPerYear) continue;
    const last = own.at(-1);
    const gap = Math.max(entry.frequency.minGapSeasons, entry.recurrence.cooldownSeasonsMinimum ?? 0);
    if (last !== undefined && index - Math.floor(last.offeredTick / SEASON) < gap) continue;
    const draw = hashSeed(state.seed, `registry-v4:${entry.id}`, index) % 1000;
    if (draw >= entry.frequency.chancePermille) continue;
    const candidateState = registryChapterPetitionDef(entry.id) === undefined ? state : prepareRegistryChapterPetition(state, entry.id);
    if (candidateState === null) continue;
    const bound = bindEntry(candidateState, entry);
    if (bound === null) continue;
    const key = dedupKey(entry, bound);
    const context = contextKey(entry, bound);
    if (past.some(occurrence => occurrence.status === "offered" && occurrence.key === key)) continue;
    if (entry.recurrence.mode === "new_context_only" && own.some(occurrence => occurrence.context === context)) continue;
    if (v4EnabledChoices(candidateState, entry, bound).length < entry.minimumEnabledConsequentialChoices) continue;
    out.push({ entry, bound, draw, key, context });
  }
  return out;
}

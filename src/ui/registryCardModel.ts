import { factionDisplayName, FACTION_SHORT_NAMES } from "../content/factionCopy.ko";
import { GENTRY_NAMES_KO } from "../content/gentryNames";
import { HOME_PETITION_ENTRY_PREFIX } from "../content/registry/homePetitions";
import { V4_SENDER_FACTION } from "../content/registry/registryHoldCopy.ko";
import { V4_COPY } from "../content/registry/v4Copy.generated";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import type { GameState } from "../engine/engine.types";
import { estatesOf } from "../engine/estates";
import { faction } from "../engine/factions";
import { personDisplayName } from "../engine/persons";
import type { Person } from "../engine/persons.types";
import { offerChoices, openRegistryOffers } from "../engine/registry";
import type { RegistryOccurrence } from "../engine/registry.types";
import { holds, type Scope } from "../engine/registryDsl";
import { bindEntry, holdCost, registryV4Support, runCommands, v4Entry, type HoldCost, type V4Choice, type V4Entry } from "../engine/registryV4";
import { stateCalendar } from "../engine/scenarioState";
import { lordMode } from "../engine/townAgency";
import { treasuryBalance } from "../ledger/ledger";
import { eventArtFor, type EventArtId } from "./eventArt";
import { calendarDays } from "./gameTimeCopy.ko";
import { courtLine } from "./lordCardsModel";
import { sinceLastAnswer, type SinceLastView } from "./lord/since/sinceLastModel";
import { BINDING_WORDS, PIECE_WORDS, REGISTRY_CARD_COPY, SUIT_STAGE_WORDS, type ShutReason } from "./registryCardCopy.ko";

// EVENT-ART: the registry event card (lord mode only, `lordMode`) — an offer the registry made from the content canon v4
// (LM-E9b: `occurrence.source === "v4"`, its targets in `occurrence.bound`; `openRegistryOffers`: offered, not past its
// deadline). Home petitions (ER-5) have their own card (LM-R1), never this one. Everything on it is the engine's: the
// canon's words (V4_COPY), what the offer is bound to and its draw (why it came), the choices the engine would carry
// out now (`offerChoices`; each other one shut with why), what a hold costs (ER-19 `holdCost`) and the deadline. The
// answer is `answer_registry_offer`, applied whole or not at all.

export type RegistryChoiceView = Readonly<{
  id: string; label: string; enabled: boolean;
  /** ER-19: a hold (no command; its cost in `cost`). */
  hold: boolean;
  /** The answer's tradeoff (the canon's), or why it is shut. */
  line: string;
  /** What holding costs, in words (holds only). */
  cost: string | null;
  /** The pennies the answer moves now (null when shut). */
  treasury: number | null;
}>;
export type RegistryOfferView = Readonly<{
  occurrenceId: string; entryId: string; art: EventArtId | null; title: string; body: string; court: string; from: string; waits: string;
  /** Why it came: what the offer is bound to, then its season's draw. */
  why: readonly string[];
  choices: readonly RegistryChoiceView[];
  /** What an unanswered offer does at its deadline. */
  lapse: string;
  /** DEC-CARD A4: what came of the lord's last answer of the same kind (a recurring rate or policy card), or null. */
  since: SinceLastView | null;
}>;
export type RegistryCard = Readonly<{ occurrence: RegistryOccurrence; entry: V4Entry }>;

/** The registry offers waiting for the lord that get this card (the canon v4's), oldest first; none outside lord mode. */
export function openRegistryCards(state: GameState): readonly RegistryCard[] {
  if (!lordMode(state)) return [];
  return openRegistryOffers(state).flatMap(occurrence => {
    if (occurrence.source !== "v4" || occurrence.entryId.startsWith(HOME_PETITION_ENTRY_PREFIX)) return [];
    const entry = v4Entry(occurrence.entryId);
    return entry === undefined ? [] : [{ occurrence, entry }];
  });
}

// --- why it came ---------------------------------------------------------------------------------------------------------

type Item = Readonly<Record<string, unknown>>;
const record = (value: unknown): Item | null => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Item : null;
const pieceWord = (pieceId: unknown) => typeof pieceId === "string" ? PIECE_WORDS[pieceId.slice(pieceId.lastIndexOf(":") + 1)] ?? null : REGISTRY_CARD_COPY.wholeEstate;

function personNamed(state: GameState, id: unknown): string | null {
  if (typeof id !== "string") return null;
  const person = [...(state.persons?.people ?? []), ...estatesOf(state).people].find(entry => entry.id === id);
  return person === undefined ? null : personDisplayName(person);
}

/** A bound target's name, read as the screens read it (a person, an estate's house, a right, a claim or suit by its right), or null. */
function itemName(state: GameState, value: unknown): string | null {
  const item = record(value);
  if (item === null) return null;
  const person = record(item.person) ?? item;
  if (typeof person.givenName === "string") return personDisplayName(person as unknown as Person);
  if (typeof item.personId === "string") return personNamed(state, item.personId);
  if (Array.isArray(item.pieces) && typeof item.name === "string") return GENTRY_NAMES_KO[item.name] ?? null;
  if (typeof item.claimant === "string") return pieceWord(item.pieceId);
  if (typeof item.claimId === "string" && typeof item.stage === "string") return REGISTRY_CARD_COPY.suit(pieceWord(item.pieceId) ?? REGISTRY_CARD_COPY.wholeEstate, SUIT_STAGE_WORDS[item.stage] ?? null);
  if (typeof item.kind === "string" && typeof item.titleHolder === "string") return PIECE_WORDS[item.kind] ?? null;
  return null;
}

/** ER-3, ER-15: why it came — the conditions held, what the offer is bound to (by name where it has one), a one-shot entry, the draw. */
export function registryWhy(state: GameState, { occurrence, entry }: RegistryCard): readonly string[] {
  const bound = bindEntry(state, entry, occurrence.bound);
  const targets = Object.keys(occurrence.bound ?? {}).flatMap(name => {
    const what = Object.hasOwn(BINDING_WORDS, name) ? BINDING_WORDS[name] : REGISTRY_CARD_COPY.boundUnknown;
    return what === null || what === undefined ? [] : [REGISTRY_CARD_COPY.bound(what, bound === null ? null : itemName(state, bound[name]))];
  });
  return [REGISTRY_CARD_COPY.conditionsHeld, ...new Set(targets), ...(entry.recurrence.mode === "once_per_campaign" ? [REGISTRY_CARD_COPY.oncePerCampaign] : []),
    REGISTRY_CARD_COPY.drawn(occurrence.receipt.chancePermille)];
}

// --- why an answer is shut -----------------------------------------------------------------------------------------------

type Node = Readonly<Record<string, unknown>>;
const node = (value: unknown): Node => record(value) ?? {};
/** The kind of a condition the canon writes, for the words of why it fails (the shapes its choices use). */
function conditionReason(condition: Node): ShutReason {
  if ("not" in condition) return { kind: "already" };
  if ("any" in condition) return (condition.any as readonly unknown[]).every(child => "not" in node(child)) ? { kind: "already" } : { kind: "condition" };
  if ("all" in condition) return JSON.stringify(condition).includes("autoplayBuildAction") ? { kind: "build" } : { kind: "condition" };
  if ("exists" in condition) return String(node(condition.exists).field ?? "").startsWith("bound.") ? { kind: "missing" } : { kind: "condition" };
  const compare = node(condition.compare);
  const left = node(compare.left); const right = node(compare.right);
  if ((left.call === "treasuryBalance" || left.field === "state.treasuryCoin") && compare.op === "gte" && typeof right.literal === "number") return { kind: "money", amount: right.literal };
  if (left.derived === "CLAIM_EVIDENCE_KINDS" && compare.op === "not_contains" && typeof right.literal === "string") return { kind: "evidence", evidence: right.literal };
  if (left.call === "subsidyRefusal") return { kind: "subsidy" };
  if (left.call === "marriageRefusal") return { kind: "marriage" };
  if (left.call === "timberTradePoint" || left.call === "timberTradeMarket") return { kind: "timber" };
  // A setting that must differ from what the choice sets (`neq`): it is so already.
  return compare.op === "neq" ? { kind: "already" } : { kind: "condition" };
}

/** Why the engine would not carry a choice out now: not yet supported, a target missing, its own condition, or refused. */
function shutReason(state: GameState, entry: V4Entry, choice: V4Choice, bound: Readonly<Record<string, unknown>> | null): ShutReason {
  if (registryV4Support().find(item => item.id === entry.id)?.choices.find(item => item.id === choice.id)?.supported !== true) return { kind: "unsupported" };
  if (bound === null) return { kind: "gone" };
  if (Object.entries(entry.bindings).some(([name, binding]) => binding.requiredForChoices?.includes(choice.id) === true && bound[name] === undefined)) return { kind: "missing" };
  const scope: Scope = { state, bound, vars: {} };
  const ast = node(choice.conditions?.ast);
  const parts = "all" in ast ? ast.all as readonly unknown[] : choice.conditions?.ast === undefined ? [] : [ast];
  const failing = parts.find(part => !holds(part, scope));
  return failing === undefined ? { kind: "refused" } : conditionReason(node(failing));
}

// --- the card ------------------------------------------------------------------------------------------------------------

function factionName(state: GameState, id: string): string {
  const view = faction(state, id as Parameters<typeof faction>[1]);
  return view === undefined ? FACTION_SHORT_NAMES[id] ?? id : factionDisplayName(view.id, view.name);
}

/** ER-19: what holding costs, in words. */
function holdWords(state: GameState, cost: HoldCost): string {
  if (cost.kind === "claim") return REGISTRY_CARD_COPY.holdClaim;
  if (cost.kind === "relation") return REGISTRY_CARD_COPY.holdRelation(factionName(state, cost.faction));
  return cost.binding === "promise" ? REGISTRY_CARD_COPY.holdPromise : REGISTRY_CARD_COPY.holdNegotiation;
}

/** Who sends it: the canon's sender, and the faction it speaks for (by the town's own name when it is one of the town's). */
function sender(state: GameState, entryId: string): string {
  const copy = V4_COPY[entryId];
  if (copy === undefined) return REGISTRY_CARD_COPY.from("", null);
  const id = V4_SENDER_FACTION[copy.senderFaction];
  const named = id === undefined ? undefined : faction(state, id as Parameters<typeof faction>[1]);
  return REGISTRY_CARD_COPY.from(copy.sender, named === undefined ? copy.senderFaction || null : factionDisplayName(named.id, named.name));
}

export type RegistryHeadline = Pick<RegistryOfferView, "occurrenceId" | "entryId" | "art" | "title" | "body" | "waits">;

/** An offer's picture, words and deadline (the story chip's; nothing is bound or tried). */
function headline(state: GameState, { occurrence, entry }: RegistryCard): RegistryHeadline {
  const copy = V4_COPY[entry.id];
  const end = stateCalendar({ ...state, tick: occurrence.deadline });
  return { occurrenceId: occurrence.id, entryId: entry.id, art: eventArtFor(entry.id), title: copy?.title ?? REGISTRY_CARD_COPY.title, body: copy?.body ?? "",
    waits: REGISTRY_CARD_COPY.waits(calendarDays(occurrence.deadline - state.tick), end.year, SCENARIO_COPY.seasons[end.season] ?? "") };
}

/** The first registry offer waiting for the lord, for its story chip, or null. */
export function registryHeadline(state: GameState): RegistryHeadline | null {
  const card = openRegistryCards(state)[0];
  return card === undefined ? null : headline(state, card);
}

/** One offer as its card shows it. */
export function registryCardView(state: GameState, card: RegistryCard): RegistryOfferView {
  const { occurrence, entry } = card;
  const copy = V4_COPY[entry.id];
  const bound = bindEntry(state, entry, occurrence.bound);
  const offered = new Set(offerChoices(state, occurrence));
  const cost = holdCost(entry);
  const before = treasuryBalance(state);
  const choices = entry.choices.flatMap((choice, index): RegistryChoiceView[] => {
    const hold = choice.commands.length === 0;
    const enabled = offered.has(choice.id);
    // ER-19 (the user's decision): a hold that costs nothing now is not a choice — it is not shown.
    if (hold && (!enabled || cost === null)) return [];
    const words = copy?.choices[choice.id];
    const label = words?.label ?? REGISTRY_CARD_COPY.choice(index + 1);
    if (!enabled) return [{ id: choice.id, label, enabled, hold, line: REGISTRY_CARD_COPY.shut(shutReason(state, entry, choice, bound)), cost: null, treasury: null }];
    const after = hold || bound === null ? state : runCommands(state, choice.commands, { state, bound, vars: {} }) ?? state;
    return [{ id: choice.id, label, enabled, hold, line: words?.tradeoff ?? REGISTRY_CARD_COPY.noTradeoff, cost: hold ? holdWords(state, cost!) : null,
      treasury: treasuryBalance(after) - before }];
  });
  return { ...headline(state, card), court: courtLine(state), from: sender(state, entry.id), why: registryWhy(state, card), choices, lapse: REGISTRY_CARD_COPY.lapse,
    since: sinceLastAnswer(state, entry.id, occurrence.id) };
}

/** The first registry offer waiting for the lord as its card shows it, or null (none, or not lord mode). */
export function registryOfferView(state: GameState): RegistryOfferView | null {
  const card = openRegistryCards(state)[0];
  return card === undefined ? null : registryCardView(state, card);
}

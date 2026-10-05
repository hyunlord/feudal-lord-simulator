import { factionDisplayName, FACTION_SHORT_NAMES } from "../content/factionCopy.ko";
import { HOME_PETITION_ENTRY_PREFIX } from "../content/registry/homePetitions";
import { REGISTRY_COPY } from "../content/registry/registryCopy.ko";
import type { RegistryChoice, RegistryCondition, RegistryEntry } from "../content/registry/registryTypes";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import type { GameState } from "../engine/engine.types";
import { faction } from "../engine/factions";
import { applyChoice, conditionHolds, openRegistryOffers, registryEntry } from "../engine/registry";
import type { RegistryOccurrence } from "../engine/registry.types";
import { stateCalendar } from "../engine/scenarioState";
import { lordMode } from "../engine/townAgency";
import { treasuryBalance } from "../ledger/ledger";
import { eventArtFor, type EventArtId } from "./eventArt";
import { calendarDays } from "./gameTimeCopy.ko";
import { LORD_CARDS_COPY } from "./lordCardsCopy.ko";
import { courtLine } from "./lordCardsModel";
import { conditionWords, REGISTRY_CARD_COPY } from "./registryCardCopy.ko";

// EVENT-ART: the registry event card (lord mode only, `lordMode`) — an offer the engine's registry made (LM-E9,
// `openRegistryOffers`: status "offered", not past its deadline) for an entry that is not a home petition (ER-5's home
// cycle has its own card, LM-R1: never shown twice). Everything on it is the engine's: the entry's words
// (REGISTRY_COPY), the receipt's conditions (why it came), each choice tried on a copy (`applyChoice`, as
// `enabledChoices` does: the treasury it moves now, or why it is shut) and the deadline. The answer is
// `answer_registry_offer`, applied whole or not at all.

export type RegistryChoiceView = Readonly<{
  id: string; label: string; enabled: boolean;
  /** The pennies the answer moves now (null when shut). */
  treasury: number | null;
  /** The answer's numbers, or why it is shut. */
  line: string;
}>;
export type RegistryOfferView = Readonly<{
  occurrenceId: string; entryId: string; art: EventArtId | null; title: string; body: string; court: string; from: string; waits: string;
  /** Why it came: the receipt's conditions in words, then the season's draw. */
  why: readonly string[];
  choices: readonly RegistryChoiceView[];
  /** What an unanswered offer does at its deadline. */
  lapse: string;
}>;
export type RegistryCard = Readonly<{ occurrence: RegistryOccurrence; entry: RegistryEntry }>;

const hasCard = (entry: RegistryEntry) => entry.generator === undefined && !entry.id.startsWith(HOME_PETITION_ENTRY_PREFIX);

/** The registry offers waiting for the lord that get this card, oldest first (none outside lord mode). */
export function openRegistryCards(state: GameState): readonly RegistryCard[] {
  if (!lordMode(state)) return [];
  return openRegistryOffers(state).flatMap(occurrence => {
    const entry = registryEntry(occurrence.entryId);
    return entry !== undefined && hasCard(entry) ? [{ occurrence, entry }] : [];
  });
}

const leaf = (condition: RegistryCondition) => "field" in condition ? conditionWords(condition) ?? REGISTRY_CARD_COPY.unknownCondition : REGISTRY_CARD_COPY.unknownCondition;

/** A condition tree as lines: each of an `all` on its own line, an `any` as one line of its parts. */
function conditionLines(condition: RegistryCondition): readonly string[] {
  if ("all" in condition) return condition.all.flatMap(conditionLines);
  if ("any" in condition) return [REGISTRY_CARD_COPY.anyOf(condition.any.map(child => conditionLines(child)))];
  return [leaf(condition)];
}

/** ER-3: why it came — the receipt's conditions (as the engine recorded them) in words, then the draw. */
export function registryWhy(occurrence: Pick<RegistryOccurrence, "receipt">): readonly string[] {
  const lines = occurrence.receipt.conditions.flatMap(recorded => {
    try { return conditionLines(JSON.parse(recorded) as RegistryCondition); } catch { return [REGISTRY_CARD_COPY.unknownCondition]; }
  });
  return [...(lines.length === 0 ? [REGISTRY_CARD_COPY.noConditions] : lines), REGISTRY_CARD_COPY.drawn(occurrence.receipt.chancePermille)];
}

/** The parts of a condition that do not hold now (an `any` counts only when none of it holds). */
function failing(state: GameState, condition: RegistryCondition, boundId: string): readonly RegistryCondition[] {
  if (conditionHolds(state, condition, boundId)) return [];
  if ("all" in condition) return condition.all.flatMap(child => failing(state, child, boundId));
  if ("any" in condition) return condition.any.flatMap(child => failing(state, child, boundId));
  return [condition];
}

/** Why the engine would not carry a choice out now: its own condition, a setting already so, or plainly shut. */
function shutReason(state: GameState, choice: RegistryChoice, boundId: string): string {
  if (choice.requires !== undefined && !conditionHolds(state, choice.requires, boundId)) {
    const line = failing(state, choice.requires, boundId).map(part => "field" in part ? conditionWords(part) : null).find(words => words !== null);
    return line === undefined || line === null ? REGISTRY_CARD_COPY.needsUnknown : REGISTRY_CARD_COPY.needs(line);
  }
  const already = choice.effects.length > 0 && choice.effects.every(effect =>
    (effect.command === "set_estate_policy" && state.agency?.policy === effect.policy)
    || (effect.command === "set_market_dues" && state.agency?.duesPermille === effect.permille));
  return already ? REGISTRY_CARD_COPY.already : REGISTRY_CARD_COPY.shut;
}

function sender(state: GameState, id: string): string {
  if (id === "lord") return REGISTRY_CARD_COPY.from(REGISTRY_CARD_COPY.fromHouse);
  // The town's own faction by its name; one the town lacks (the slice has no crown or commons) by its kind's name.
  const view = faction(state, id as Parameters<typeof faction>[1]);
  const name = view === undefined ? FACTION_SHORT_NAMES[id] : factionDisplayName(view.id, view.name);
  return name === undefined ? REGISTRY_CARD_COPY.fromUnknown : REGISTRY_CARD_COPY.from(name);
}

export type RegistryHeadline = Pick<RegistryOfferView, "occurrenceId" | "entryId" | "art" | "title" | "body" | "waits">;

/** An offer's picture, words and deadline (the story chip's; no choice is tried). */
function headline(state: GameState, { occurrence, entry }: RegistryCard): RegistryHeadline {
  const copy = REGISTRY_COPY[entry.id];
  const end = stateCalendar({ ...state, tick: occurrence.deadline });
  return { occurrenceId: occurrence.id, entryId: entry.id, art: eventArtFor(entry), title: copy?.title ?? REGISTRY_CARD_COPY.title, body: copy?.body ?? "",
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
  const copy = REGISTRY_COPY[entry.id];
  const before = treasuryBalance(state);
  const choices = entry.choices.map((choice, index): RegistryChoiceView => {
    const label = copy?.choices[choice.id]?.label ?? REGISTRY_CARD_COPY.choice(index + 1);
    const after = applyChoice(state, entry, choice.id, occurrence.boundId, occurrence.id);
    if (after === null) return { id: choice.id, label, enabled: false, treasury: null, line: shutReason(state, choice, occurrence.boundId) };
    const treasury = treasuryBalance(after) - before;
    return { id: choice.id, label, enabled: true, treasury, line: LORD_CARDS_COPY.treasury(treasury) };
  });
  const lapsed = entry.lapseChoice === undefined ? null : choices.find(choice => choice.id === entry.lapseChoice)?.label ?? null;
  return { ...headline(state, card), court: courtLine(state), from: sender(state, entry.sender), why: registryWhy(occurrence), choices, lapse: REGISTRY_CARD_COPY.lapse(lapsed) };
}

/** The first registry offer waiting for the lord as its card shows it, or null (none, or not lord mode). */
export function registryOfferView(state: GameState): RegistryOfferView | null {
  const card = openRegistryCards(state)[0];
  return card === undefined ? null : registryCardView(state, card);
}

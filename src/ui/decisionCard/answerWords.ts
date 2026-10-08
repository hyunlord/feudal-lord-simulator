import { SCENARIO_COPY } from "../../content/scenario/scenarioCopy.ko";
import { factionDisplayName } from "../../content/factionCopy.ko";
import { GENTRY_NAMES_KO } from "../../content/gentryNames";
import type { GameState } from "../../engine/engine.types";
import { estatePerson, estatesOf } from "../../engine/estates";
import { faction } from "../../engine/factions";
import { personDisplayName } from "../../engine/persons";
import { calendar, scenarioOf } from "../../engine/scenarioState";
import { LORD_OUTCOME_COPY as COPY, LORD_OUTCOME_WORDS as WORDS } from "./families/lordOutcomeCopy.ko";

// DEC-CARD: the names and dates an answer's lines use, on every card — a tick as its year and season, a holder (ES-1
// HolderId: the lord, a person, a neighbour's house, a faction) as the lord screens write it.

/** "1305년 여름": a tick's year and season (glossary rule 5: no ticks, no days counted down). */
export function dateWord(state: GameState, tick: number): string {
  const date = calendar(tick, scenarioOf(state).startYear);
  return COPY.date(date.year, SCENARIO_COPY.seasons[date.season] ?? "");
}

/** A faction by the town's own name for it, or its id when the town has no such faction. */
export function factionWord(state: GameState, id: string): string {
  const view = faction(state, id as Parameters<typeof faction>[1]);
  return view === undefined ? id : factionDisplayName(view.id, view.name);
}

/** A holder's name (ES-1 HolderId) as the lord screens write it: the lord, a person, a neighbour's house, a faction. */
export function holderName(state: GameState, holder: string): string {
  if (holder.startsWith("person:")) {
    const id = holder.slice("person:".length);
    const person = estatePerson(state, id) ?? state.persons?.people.find(entry => entry.id === id);
    return person === undefined ? WORDS.oldKin : personDisplayName(person);
  }
  if (holder.startsWith("estate:")) {
    const estate = estatesOf(state).estates.find(entry => entry.id === holder.slice("estate:".length));
    const name = estate?.house?.name ?? estate?.name ?? holder;
    return WORDS.houseOf(GENTRY_NAMES_KO[name] ?? name);
  }
  return WORDS.holders[holder] ?? factionWord(state, holder);
}

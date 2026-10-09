import type { GameState } from "../../engine/engine.types";
import { pauseReasons, type PauseEvent } from "../../engine/autoPause";
import { estatesOf } from "../../engine/estates";
import { openPetitions } from "../../engine/politics";
import { lordMode } from "../../engine/townAgency";
import { PETITION_SUBJECTS } from "../../content/historyCopy.ko";
import { recordSentence } from "../legacy/chapterRecords";
import { homePetitionView } from "../lordCardsModel";
import { offMapPetitionView } from "../lord/decisions/decisionCardsModel";
import type { LordScreenId } from "../lord/screen/lordScreenTypes";
import { houseChangeView } from "../results/houseChange";
import type { UiModal } from "../stateMachine/uiStateMachine";
import { AUTO_PAUSE_COPY } from "./autoPauseCopy.ko";

// LM-R3 (lord slice LS-2, lord-mode design 3.5): the screen's half of the auto-pause. The engine names why the game
// should stop between two states (`pauseReasons`); here is which pairs are a turn of the game (a tick batch or a
// command) and what the notice says. A load, a new game or the tick going back is no turn: the baseline moves on and
// nothing stops. No engine rule is copied here: the reasons are the engine's, the sentences the ledger's.

/** What the screen remembers between states: the last state seen and the stops already made (by record or petition). */
export interface AutoPauseMemory {
  readonly baseline: GameState;
  readonly seen: ReadonlySet<string>;
}

export const autoPauseMemory = (state: GameState): AutoPauseMemory => ({ baseline: state, seen: new Set() });

/** One stop, once: the ledger line it was read from, or the petition. */
export const pauseEventKey = (event: PauseEvent): string => event.recordId ?? `petition:${event.petitionId ?? `${event.reason}:${event.tick}`}`;

/**
 * Whether `state` follows `baseline` in play: a tick batch committed from it (the store's previous state is the baseline
 * itself, compared by identity), or a command on the same tick of the same game. Anything else (a load, a new game, the tick going back) is not.
 */
export function playedOn(baseline: GameState, state: GameState, previous: unknown): boolean {
  if (state.tick > baseline.tick) return previous === baseline;
  return state.tick === baseline.tick && lordMode(baseline) && state.seed === baseline.seed && state.scenarioId === baseline.scenarioId;
}

/** The next memory after `state` and the reasons it newly stops for (lord mode only; empty: time runs on). */
export function autoPauseStep(memory: AutoPauseMemory, state: GameState, previous: unknown): { readonly memory: AutoPauseMemory; readonly fresh: readonly PauseEvent[] } {
  if (state === memory.baseline) return { memory, fresh: [] };
  if (!playedOn(memory.baseline, state, previous) || !lordMode(state)) return { memory: autoPauseMemory(state), fresh: [] };
  const fresh = pauseReasons(memory.baseline, state).filter(event => !memory.seen.has(pauseEventKey(event)));
  if (fresh.length === 0) return { memory: { baseline: state, seen: memory.seen }, fresh };
  return { memory: { baseline: state, seen: new Set([...memory.seen, ...fresh.map(pauseEventKey)]) }, fresh };
}

/** Where the screen already answers a reason: a lord screen on one of its ids, or one of the decision cards. */
export type AutoPauseLink =
  | { readonly kind: "lord"; readonly screen: LordScreenId; readonly focus: string | null }
  | { readonly kind: "modal"; readonly modal: UiModal };

export interface AutoPauseLine {
  readonly key: string;
  readonly word: string;
  readonly sentence: string;
  readonly link: AutoPauseLink | null;
  readonly linkLabel: string | null;
}

/** The notice's lines, oldest first: the reason's word, the ledger's sentence (or the petition's subject) and its link. */
export function autoPauseLines(state: GameState, events: readonly PauseEvent[]): readonly AutoPauseLine[] {
  return events.map(event => {
    const record = event.recordId === undefined ? undefined : state.history?.records.find(entry => entry.id === event.recordId);
    const petition = event.petitionId === undefined ? undefined : state.politics?.petitions.find(entry => entry.id === event.petitionId);
    const subject = petition === undefined ? undefined : PETITION_SUBJECTS[petition.defId];
    const sentence = record !== undefined ? recordSentence(state, record)
      : event.petitionId !== undefined ? (subject === undefined ? AUTO_PAUSE_COPY.petitionUnknown : AUTO_PAUSE_COPY.petition(subject)) : "";
    const { link, label } = linkOf(state, event, record?.params ?? {});
    return { key: pauseEventKey(event), word: AUTO_PAUSE_COPY.reasons[event.reason], sentence, link, linkLabel: label };
  });
}

const LINKS = AUTO_PAUSE_COPY.links;

function linkOf(state: GameState, event: PauseEvent, params: Readonly<Record<string, string | number>>): { readonly link: AutoPauseLink | null; readonly label: string | null } {
  const none = { link: null, label: null };
  switch (event.reason) {
    case "counter_offer": return { link: { kind: "lord", screen: "marriage", focus: null }, label: LINKS.marriage };
    case "judgment": return params.suit === undefined ? none : { link: { kind: "lord", screen: "ledger", focus: String(params.suit) }, label: LINKS.suit };
    case "estate_gained":
    case "estate_lost": {
      const estate = String(params.estate ?? "");
      if (estate === "") return none;
      // The suit that moved it, the latest on that estate; without one (a marriage's inheritance), the estate's card.
      const suit = estatesOf(state).suits.filter(entry => entry.estateId === estate).sort((a, b) => b.stageSince - a.stageSince)[0];
      return suit === undefined ? { link: { kind: "lord", screen: "estates", focus: estate }, label: LINKS.estate }
        : { link: { kind: "lord", screen: "ledger", focus: suit.id }, label: LINKS.suit };
    }
    case "inheritance": return houseChangeView(state) === null ? none : { link: { kind: "modal", modal: "house_change" }, label: LINKS.house };
    case "rights_petition": {
      // The card shows the first waiting petition of its kind: linked only when it is this one (or the only kind's own).
      if (event.petitionId !== undefined) return openPetitions(state)[0]?.id === event.petitionId ? { link: { kind: "modal", modal: "petition" }, label: LINKS.petition } : none;
      if (event.template === "manor.petition") return homePetitionView(state) === null ? none : { link: { kind: "modal", modal: "estate_petition" }, label: LINKS.petition };
      if (event.template === "stewardship.escalated") return offMapPetitionView(state) === null ? none : { link: { kind: "modal", modal: "estate_petition_offmap" }, label: LINKS.petition };
      return none;
    }
    default: return none;
  }
}

import type { GameState } from "../../engine/engine.types";
import type { PauseEvent } from "../../engine/autoPause";
import type { LordMatterDue } from "../../engine/lordDue";
import { estatesOf } from "../../engine/estates";
import { openPetitions } from "../../engine/politics";
import { PETITION_SUBJECTS } from "../../content/historyCopy.ko";
import { dateWord } from "../decisionCard/answerWords";
import { recordSentence } from "../legacy/chapterRecords";
import { homePetitionView } from "../lordCardsModel";
import { marriageDecisionHead, offMapPetitionView } from "../lord/decisions/decisionCardsModel";
import { lordMatterBeats } from "../lord/decisions/lordMatterBeats";
import { LORD_MATTER_CHIP } from "../lord/decisions/lordMattersDue";
import type { LordScreenId } from "../lord/screen/lordScreenTypes";
import { houseChangeView } from "../results/houseChange";
import type { UiModal } from "../stateMachine/uiStateMachine";
import { AUTO_PAUSE_COPY } from "./autoPauseCopy.ko";
import type { AutoPauseItem } from "./autoPauseModel";

// LM-R3 (lord slice LS-2): what the auto-pause's notice says for each reason — its word, the engine's own sentence (the
// ledger line; for a matter due, the line its chip says) and a link where the screen already answers it (the same
// places the chips open).

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

const LINKS = AUTO_PAUSE_COPY.links;
const none = { link: null, label: null } as const;

/** The notice's lines, in the order they came: the reason's word, the engine's sentence and its link. */
export function autoPauseLines(state: GameState, items: readonly AutoPauseItem[]): readonly AutoPauseLine[] {
  return items.map(item => item.kind === "event" ? eventLine(state, item.key, item.event) : matterLine(state, item.key, item.matter));
}

function eventLine(state: GameState, key: string, event: PauseEvent): AutoPauseLine {
  const record = event.recordId === undefined ? undefined : state.history?.records.find(entry => entry.id === event.recordId);
  const petition = event.petitionId === undefined ? undefined : state.politics?.petitions.find(entry => entry.id === event.petitionId);
  const subject = petition === undefined ? undefined : PETITION_SUBJECTS[petition.defId];
  const sentence = record !== undefined ? recordSentence(state, record)
    : event.petitionId !== undefined ? (subject === undefined ? AUTO_PAUSE_COPY.petitionUnknown : AUTO_PAUSE_COPY.petition(subject)) : "";
  const { link, label } = eventLink(state, event, record?.params ?? {});
  return { key, word: AUTO_PAUSE_COPY.reasons[event.reason], sentence, link, linkLabel: label };
}

function eventLink(state: GameState, event: PauseEvent, params: Readonly<Record<string, string | number>>): { readonly link: AutoPauseLink | null; readonly label: string | null } {
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

/** A matter due: its chip's line (the engine's sentence of the filing or the warning; the will's and the contest's head). */
function matterLine(state: GameState, key: string, matter: LordMatterDue): AutoPauseLine {
  const word = AUTO_PAUSE_COPY.matters[matter.kind];
  const when = matter.dueTick === null ? null : dateWord(state, matter.dueTick);
  const join = (line: string) => AUTO_PAUSE_COPY.matterSentence(line, when);
  if (matter.kind === "will_change" || matter.kind === "contested") {
    const head = marriageDecisionHead(state);
    const link: AutoPauseLink = matter.kind === "will_change" ? { kind: "lord", screen: "marriage", focus: null } : { kind: "modal", modal: "marriage_decision" };
    return { key, word, sentence: join(head?.line ?? ""), link, linkLabel: matter.kind === "will_change" ? LINKS.marriage : LINKS.contested };
  }
  const chip = matter.kind === "suit_defence" ? LORD_MATTER_CHIP.suit(matter.id) : LORD_MATTER_CHIP.entry(matter.id);
  const line = lordMatterBeats(state).find(beat => beat.id === chip)?.line ?? "";
  return { key, word, sentence: join(line), link: { kind: "lord", screen: "ledger", focus: matter.id }, linkLabel: matter.kind === "suit_defence" ? LINKS.suit : LINKS.entry };
}

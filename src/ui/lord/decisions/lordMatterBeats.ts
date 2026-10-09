import type { GameState } from "../../../engine/engine.types";
import { estatesOf } from "../../../engine/estates";
import { lordMattersDue } from "../../../engine/lordDue";
import { dateWord } from "../../decisionCard/answerWords";
import type { StoryBeat } from "../../eventStory";
import { recordSentence } from "../../legacy/chapterRecords";
import { SUIT_STAGE_WORDS } from "../../registryCardCopy.ko";
import { DECISION_CARDS_COPY } from "./decisionCardsCopy.ko";
import { auditDecisionHead, offMapPetitionHead } from "./decisionCardsModel";
import { LORD_MATTER_CHIP } from "./lordMattersDue";
import { LORD_MATTERS_COPY as COPY } from "./lordMattersCopy.ko";

// SUIT-THREAD (Astra lordplay2 ⑦, TOP10 8): the engine's matters against the lord that wait for his answer by a time
// (`lordMattersDue`): a suit against him and a forcible entry forewarned, one chip each, kept until answered or past
// (useStoryPresentation). Each chip's line is the engine's own sentence of the filing or the warning (its history record),
// its facts the stage and the engine's tick it moves on (as a season); its button opens the 약속·소송 page on the suit or
// the threat (`screen`), where the lord answers it. No picture: with one the suit's card ran under the steward's line at
// 1280 × 720 (the filing's moment, which the suit's chip stands for, has it). The father's will is the decision cards'
// chip (lordStoryBeats). PLAY-2 §4: a Michaelmas audit's finding and an off-map estate's petition, by the engine's
// deadline (as a season, as the will's), each opening its decision card. A card shows the first waiting one of its kind
// (its head, DecideButton), so only that one has a chip; the others keep theirs for when they come up.

/** The engine's sentence of a record of this template naming this id in this parameter, else the fallback. */
function sentenceOf(state: GameState, template: string, key: string, id: string, fallback: string): string {
  const records = state.history?.records ?? [];
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index]!;
    if (record.template === template && record.params?.[key] === id) return recordSentence(state, record);
  }
  return fallback;
}

/** The suits against the lord, the entries forewarned, the audit and the off-map petition the cards show, as chips (lord
 * mode only: the engine's list is empty otherwise). */
export function lordMatterBeats(state: GameState): readonly StoryBeat[] {
  const beats: StoryBeat[] = [];
  const audit = auditDecisionHead(state);
  const petition = offMapPetitionHead(state);
  for (const matter of lordMattersDue(state)) {
    const when = matter.dueTick === null ? null : dateWord(state, matter.dueTick);
    if (matter.kind === "suit_defence") {
      const suit = estatesOf(state).suits.find(entry => entry.id === matter.id);
      if (suit === undefined) continue;
      beats.push({ id: LORD_MATTER_CHIP.suit(suit.id), kind: "lord_decision", illustration: null, tile: null, decision: null,
        screen: { screen: "ledger", focus: suit.id }, openLabel: COPY.suitOpen,
        title: COPY.suitTitle, line: sentenceOf(state, "estate.suit_filed", "suit", suit.id, COPY.suitLine),
        facts: [COPY.suitStage(SUIT_STAGE_WORDS[suit.stage] ?? suit.stage), when === null ? COPY.suitWaits : COPY.suitNext(when)], advice: COPY.suitAdvice });
    } else if (matter.kind === "entry_threat") {
      beats.push({ id: LORD_MATTER_CHIP.entry(matter.id), kind: "lord_decision", illustration: null, tile: null, decision: null,
        screen: { screen: "ledger", focus: matter.id }, openLabel: COPY.entryOpen,
        title: COPY.entryTitle, line: sentenceOf(state, "estate.entry_threatened", "threat", matter.id, COPY.entryLine),
        facts: when === null ? [] : [COPY.entryComes(when)], advice: COPY.entryAdvice });
    } else if (matter.kind === "audit" && audit?.auditId === matter.id) {
      beats.push({ id: LORD_MATTER_CHIP.audit(audit.auditId), kind: "lord_decision", illustration: null, tile: null, decision: "audit_decision",
        title: audit.title, line: audit.line, facts: [audit.kicker, when === null ? audit.waits : COPY.auditDue(when)], advice: DECISION_CARDS_COPY.auditAdvice });
    } else if (matter.kind === "estate_petition" && petition?.petitionId === matter.id) {
      const due = when === null ? petition.waits : COPY.petitionDue(when);
      beats.push({ id: LORD_MATTER_CHIP.petition(petition.petitionId), kind: "lord_decision", illustration: null, tile: null, decision: "estate_petition_offmap",
        title: petition.title, line: petition.line, facts: petition.why === "" ? [due] : [due, petition.why], advice: DECISION_CARDS_COPY.petitionAdvice });
    }
  }
  return beats;
}

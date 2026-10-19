import { traceInRange } from "../../../engine/decisionReads";
import type { GameState } from "../../../engine/engine.types";
import { lordMode } from "../../../engine/townAgency";
import { recordIndex } from "../../chronicle/historyIndex";
import { chronicleDate } from "../../chronicle/chronicleScreenModel";
import { factionWord } from "../../decisionCard/answerWords";
import type { StoryBeat } from "../../eventStory";
import { decisionSubjectWords } from "../../results/decisionThread";
import { RELATION_STAGE_COPY as COPY } from "../relationStageCopy.ko";
import { stageCrossings, type StageCrossing } from "./stageTrack";

/**
 * LS1 ③ (lord-screen-v1.md §3): one chip when a faction's relation crosses a stage at a season's close ("상인 가문: 못마땅 →
 * 화남"), for the season after it (lord mode). Its cause (P-C2, no more than the engine says): the one decision whose
 * `relation` trace rows moved that faction that way in the season, else "여러 까닭". The numbers inside a stage are the
 * faction screen's and the year card's, not chips.
 */
export function relationStageBeats(state: GameState): readonly StoryBeat[] {
  if (!lordMode(state)) return [];
  return stageCrossings().map(crossing => {
    const name = factionWord(state, crossing.factionId);
    const title = COPY.crossed(name, COPY.names[String(crossing.from) as keyof typeof COPY.names], COPY.names[String(crossing.to) as keyof typeof COPY.names]);
    return { id: `stage:${crossing.factionId}:${crossing.year}:${crossing.season}`, kind: "relation_stage", illustration: null, tile: null, decision: null,
      title, chip: COPY.chip(crossing.factionId, name, COPY.names[String(crossing.to) as keyof typeof COPY.names]), line: causeOf(state, crossing), facts: [], advice: COPY.advice };
  });
}

/** The crossing's cause: the one decision that moved the faction its way in the season, else several causes. */
function causeOf(state: GameState, crossing: StageCrossing): string {
  const sign = Math.sign(crossing.to - crossing.from);
  const rows = traceInRange(state, crossing.fromTick + 1, crossing.toTick + 1)
    .filter(row => row.key === "relation" && row.actor === crossing.factionId && row.delta !== null && Math.sign(row.delta) === sign);
  const decisions = [...new Set(rows.map(row => row.decisionId))];
  const record = decisions.length === 1 ? recordIndex(state).get(decisions[0]!) : undefined;
  return record === undefined ? COPY.severalCauses : COPY.cause(chronicleDate(state, record.tick), decisionSubjectWords(state, record));
}

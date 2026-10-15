/**
 * LS1 ③ (lord-screen-v1.md §3, "세력 관계, 단계를 넘을 때"): a chip when a faction's relation crosses a stage between two
 * season closes — the engine's `relationStage` ranks (DTR-4's ±30, ±60; v56), the stages named in relationStageCopy.ko.ts —
 * its cause the one decision that moved the faction that way in the season, else "여러 까닭" (P-C2). A move inside a stage
 * is no chip; after a load the first close only takes the ranks.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import { relationStage } from "../src/engine/relationStage";
import { advanceTick } from "../src/engine/tick";
import { newGameState } from "../src/state/newGame";
import { chronicleDate } from "../src/ui/chronicle/chronicleScreenModel";
import { factionWord } from "../src/ui/decisionCard/answerWords";
import { relationStageBeats } from "../src/ui/lord/relations/relationStageBeats";
import { noteStageClose, stageCrossings, startStageTrack } from "../src/ui/lord/relations/stageTrack";
import { RELATION_STAGE_COPY } from "../src/ui/lord/relationStageCopy.ko";
import { decisionSubjectWords } from "../src/ui/results/decisionThread";

const start = advanceTick(newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!);
const factionId = start.factions!.factions[0]!.id;
const withRelation = (state: GameState, relation: number, memory: readonly unknown[] = [], records: readonly HistoryRecord[] = []): GameState => ({
  ...state, history: { ...state.history!, records: [...(state.history?.records ?? []), ...records] },
  factions: { ...state.factions!, factions: state.factions!.factions.map(faction => faction.id === factionId ? { ...faction, relation, memory: [...faction.memory, ...memory] } as typeof faction : faction) } });
const close = (season: number) => ({ year: 1300, season, startTick: season * 1_000, endTick: (season + 1) * 1_000 });

test("the engine's stages: DTR-4's thresholds, the same comparisons", () => {
  assert.deepEqual([-60, -59, -30, -29, 0, 29, 30, 59, 60].map(value => relationStage(value).rank), [-2, -1, -1, 0, 0, 0, 1, 1, 2]);
});

test("a crossing between two closes is one chip, named by the stages; a move inside a stage is none", () => {
  startStageTrack(withRelation(start, 25));
  noteStageClose(withRelation(start, 28), close(0));
  assert.deepEqual(stageCrossings(), [], "25 → 28: inside 무덤덤");
  assert.equal(relationStageBeats(withRelation(start, 28)).length, 0);
  noteStageClose(withRelation(start, 31), close(1));
  const [chip] = relationStageBeats(withRelation(start, 31));
  assert.equal(chip?.id, `stage:${factionId}:1300:1`);
  assert.equal(chip?.kind, "relation_stage");
  assert.equal(chip?.title, `${factionWord(start, factionId)}: 무덤덤 → 호의`);
  assert.equal(chip?.line, RELATION_STAGE_COPY.severalCauses, "no decision in the season moved it: several causes");
  noteStageClose(withRelation(start, 31), close(2));
  assert.equal(relationStageBeats(withRelation(start, 31)).length, 0, "the next close: the chip's season is over");
});

test("its cause: the one decision whose relation rows moved the faction that way in the season", () => {
  const decision = { id: "h-d1", tick: 1_200, template: "decision.card", subject: { type: "town", id: "town" }, params: {} } as unknown as HistoryRecord;
  const memory = { recordId: "h-m1", tick: 1_300, delta: -8, reason: "petition:test:refuse", decisionId: "h-d1" };
  startStageTrack(withRelation(start, -25));
  const after = withRelation(start, -33, [memory], [decision]);
  noteStageClose(after, close(1));
  const [chip] = relationStageBeats(after);
  assert.equal(chip?.title, `${factionWord(start, factionId)}: 무덤덤 → 못마땅`);
  assert.equal(chip?.line, RELATION_STAGE_COPY.cause(chronicleDate(after, 1_200), decisionSubjectWords(after, decision)));
  // Two decisions moved it: neither is "the" cause.
  const second = { ...decision, id: "h-d2", tick: 1_400 } as HistoryRecord;
  startStageTrack(withRelation(start, -25));
  const both = withRelation(start, -40, [memory, { ...memory, recordId: "h-m2", tick: 1_500, decisionId: "h-d2" }], [decision, second]);
  noteStageClose(both, close(1));
  assert.equal(relationStageBeats(both)[0]?.line, RELATION_STAGE_COPY.severalCauses);
});

test("after a load the first close only takes the ranks", () => {
  startStageTrack(null);
  noteStageClose(withRelation(start, 70), close(0));
  assert.deepEqual(stageCrossings(), []);
  noteStageClose(withRelation(start, 40), close(1));
  assert.equal(relationStageBeats(withRelation(start, 40))[0]?.title, `${factionWord(start, factionId)}: 두터운 믿음 → 호의`);
});

test("the audit's stage-seed: a loaded state counted as a close seen with that faction at that rank", () => {
  startStageTrack(withRelation(start, 10), { factionId, rank: -1 });
  noteStageClose(withRelation(start, 10), close(0));
  assert.equal(relationStageBeats(withRelation(start, 10))[0]?.title, `${factionWord(start, factionId)}: 못마땅 → 무덤덤`);
  startStageTrack(withRelation(start, 10), { factionId: "no-such-faction", rank: -1 });
  noteStageClose(withRelation(start, 10), close(0));
  assert.deepEqual(stageCrossings(), [], "an unknown faction seeds nothing");
});

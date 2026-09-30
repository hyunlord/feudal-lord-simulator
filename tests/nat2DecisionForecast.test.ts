import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GUILD_DISPUTE_PETITION_ID } from "../src/content/legacyConfig";
import type { GameState } from "../src/engine/engine.types";
import { openPetitions } from "../src/engine/politics";
import { decodeSave } from "../src/save/saveCodec";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { DECISION_COPY } from "../src/ui/decisionCopy.ko";
import { petitionDecisionView, type FamineDecisionView } from "../src/ui/decisionModels";
import { FamineDecisionModal, PetitionModal } from "../src/ui/hud/StoryModals";
import { at, movedTo, runAnswering } from "./helpers/legacyTown";

// NAT-2 (QA-009): an answer without a forecast shows no "두 계절 뒤 예측 ·" line; one with numbers keeps it. Astra's cards:
// the guild's quarrel (1394) of the chapter-5 town (fixture `chapter-five-town`, the calendar moved as the tests do).
const noop = () => undefined;

test("NAT-2 QA-009: the forecast line is none for empty numbers, the numbers after the heading otherwise", () => {
  assert.equal(DECISION_COPY.predictedLine(""), null);
  assert.equal(DECISION_COPY.predictedLine("  "), null);
  assert.equal(DECISION_COPY.predictedLine("금고 210d(지금 60d)"), "두 계절 뒤 예측 · 금고 210d(지금 60d)");
});

test("NAT-2 QA-009: the guild's quarrel (no forecast yet) shows its answers without the empty prediction line", () => {
  // Given: Astra's chapter-5 town at the spring of 1394, the guild's petition open
  const town = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v32/chapter-five-town.save.json"))).envelope.state as GameState;
  const quarrel = runAnswering(movedTo(town, at(1394)), at(1394) + 1, {});
  assert.ok(openPetitions(quarrel).some(petition => petition.defId === GUILD_DISPUTE_PETITION_ID));
  const shown = petitionDecisionView(quarrel)!;
  assert.equal(shown.presentation.defId, GUILD_DISPUTE_PETITION_ID);
  // UI-10: the quarrel's answers now carry the treasury (`legacyDecisionForecast`); the card is drawn with them taken away.
  const view = { ...shown, options: shown.options.map(option => ({ ...option, predicted: "" })) };

  // When
  const markup = renderToStaticMarkup(createElement(PetitionModal, { view, onRespond: noop, onLater: noop }));

  // Then
  assert.equal((markup.match(/class="petition-option ui-btn/g) ?? []).length, view.options.length);
  assert.doesNotMatch(markup, /두 계절 뒤 예측/);
  assert.doesNotMatch(markup, /petition-predicted/);
});

test("NAT-2 QA-009: an answer the engine predicts keeps its line (the market charter), the empty one beside it has none", () => {
  // Given: chapter 1's market charter (its answers predicted by the engine)
  const state = { ...DEFAULT_GAME_STATE, tick: 30_000, politics: { merchantGauge: 50, petitions: [{ id: "market_charter@30000", defId: "market_charter", petitioner: "merchants", arrivedTick: 30_000 }],
    rights: [], decisions: [], chapter: { number: 1, startTick: 0, populationStart: 12, peakPopulation: 12 }, chapterEnds: [] } } as unknown as GameState;
  const view = petitionDecisionView(state)!;
  const famine: FamineDecisionView = { eventId: "great_famine@67", options: [
    { choice: "relief", label: "구휼", line: "빵", predicted: "인구 10(지금 12)", illustration: "decision_relief" },
    { choice: "laissez_faire", label: "방관", line: "없음", predicted: "", illustration: "decision_laissez_faire" },
  ] };

  // When
  const petition = renderToStaticMarkup(createElement(PetitionModal, { view, onRespond: noop, onLater: noop }));
  const decision = renderToStaticMarkup(createElement(FamineDecisionModal, { view: famine, onChoose: noop, onLater: noop }));

  // Then
  assert.equal((petition.match(/class="petition-predicted">두 계절 뒤 예측 · /g) ?? []).length, view.options.length);
  assert.match(petition, /두 계절 뒤 예측 · 금고 210d\(지금 60d\)/);
  assert.equal((decision.match(/famine-option-predicted/g) ?? []).length, 1, "the predicted answer only");
  assert.match(decision, /두 계절 뒤 예측 · 인구 10\(지금 12\)/);
});

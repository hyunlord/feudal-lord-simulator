import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GUILD_DISPUTE_PETITION_ID } from "../src/content/legacyConfig";
import type { GameState } from "../src/engine/engine.types";
import { openPetitions } from "../src/engine/politics";
import { treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { famineCard } from "../src/ui/decisionCard/families/famineCard";
import { PETITION_CARD_COPY } from "../src/ui/decisionCard/families/petitionCardCopy.ko";
import { petitionCard } from "../src/ui/decisionCard/families/petitionCard";
import { FamineDecisionModal, PetitionModal } from "../src/ui/hud/StoryModals";
import { famineState } from "./helpers/deccardCampaignStates";
import { at, movedTo, runAnswering } from "./helpers/legacyTown";

// NAT-2 (QA-009): an answer's forecast is a line only when the engine gives it numbers. DEC-CARD: the forecast is one of
// the answer's "later" lines, read off the decision record the answer writes (HL-3); an answer the engine does not
// predict has no forecast line, never an empty heading. Astra's cards: the guild's quarrel (1394) of the chapter-5 town
// (fixture `chapter-five-town`, the calendar moved as the tests do), chapter 1's charter, the famine.
const noop = () => undefined;
const FORECAST = /두 계절 뒤/;

test("NAT-2 QA-009: the guild's quarrel shows its answers, each with the engine's forecast and nothing empty", () => {
  // Given: Astra's chapter-5 town at the spring of 1394, the guild's petition open
  const town = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v32/chapter-five-town.save.json"))).envelope.state as GameState;
  const quarrel = runAnswering(movedTo(town, at(1394)), at(1394) + 1, {});
  assert.ok(openPetitions(quarrel).some(petition => petition.defId === GUILD_DISPUTE_PETITION_ID));
  const view = petitionCard(quarrel)!;
  assert.equal(view.defId, GUILD_DISPUTE_PETITION_ID);

  // When
  const markup = renderToStaticMarkup(createElement(PetitionModal, { view, onRespond: noop, onLater: noop }));

  // Then: the quarrel moves no money, and the forecast says so in words
  assert.equal((markup.match(/class="decision-card-choice"/g) ?? []).length, view.card.choices.length);
  for (const choice of view.card.choices) assert.ok(choice.later.includes(PETITION_CARD_COPY.forecast(treasuryBalance(quarrel), treasuryBalance(quarrel))), choice.later.join(" | "));
  assert.doesNotMatch(markup, /두 계절 뒤 예측 ·\s*</);
});

test("NAT-2 QA-009: an answer the engine predicts keeps its forecast (the market charter, the famine); without numbers there is none", () => {
  // Given: chapter 1's market charter (its answers predicted by the engine) and the arriving famine
  const state = { ...DEFAULT_GAME_STATE, tick: 30_000, politics: { merchantGauge: 50, petitions: [{ id: "market_charter@30000", defId: "market_charter", petitioner: "merchants", arrivedTick: 30_000 }],
    rights: [], decisions: [], chapter: { number: 1, startTick: 0, populationStart: 12, peakPopulation: 12 }, chapterEnds: [] } } as unknown as GameState;
  const petition = petitionCard(state)!;
  const famine = famineCard(famineState())!;
  const unpredicted = { ...famine, card: { ...famine.card, choices: famine.card.choices.map((choice, index) => index === 0 ? choice : { ...choice, later: choice.later.filter(line => !FORECAST.test(line)) }) } };

  // When
  const petitionMarkup = renderToStaticMarkup(createElement(PetitionModal, { view: petition, onRespond: noop, onLater: noop }));
  const famineMarkup = renderToStaticMarkup(createElement(FamineDecisionModal, { view: unpredicted, onChoose: noop, onLater: noop }));

  // Then: FIX-4 E1 — the game opens with 60d; the charter fee is 150d on top (210d = 17s 6d, 60d = 5s)
  assert.ok(petition.card.choices.every(choice => choice.later.some(line => FORECAST.test(line))));
  assert.match(petitionMarkup, /두 계절 뒤 금고는 17s 6d로 봅니다\(지금 5s\)/);
  assert.equal((famineMarkup.match(/두 계절 뒤 인구는/g) ?? []).length, 1, "the predicted answer only");
});

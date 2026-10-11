/**
 * WELCOME-MODE (user 2026-10-11: a player started the build and "nothing grows or builds by itself"): the start screen
 * closes only by a mode button (or 이어하기 over a save) — a click outside starts nothing and closes nothing; it opens on
 * every load for a player; lord mode starts with the town's agency, the sandbox without; each mode's line says who builds.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RIVERSIDE_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { DEFAULT_HOUSE_CHOICE } from "../src/ui/houseChoice";
import { landStartCommand, type LandChoice } from "../src/ui/landChoice";
import { WelcomeParchment, welcomeClickCloses, welcomeOpensOnLoad } from "../src/ui/screens/WelcomeScreen";
import { TUTORIAL_COPY } from "../src/ui/tutorial/tutorialCopy.ko";

const LAND: LandChoice = { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 1 };
const welcome = () => renderToStaticMarkup(createElement(WelcomeParchment, {
  onDismiss: () => undefined, continueLine: null, archiveNotice: null, onContinue: () => undefined, onNewGame: () => undefined,
  onChooseMode: () => undefined, tutorialEnabled: true, onTutorialChange: () => undefined, initialLand: LAND,
}));
const started = (scenarioId: string) => {
  const command = landStartCommand(scenarioId, LAND, false, DEFAULT_HOUSE_CHOICE);
  assert.ok(command !== null, scenarioId);
  return gameReducer(DEFAULT_GAME_STATE, command);
};

test("a player's click outside the buttons closes nothing and starts nothing — with or without a save, any land", () => {
  for (const continueLine of [null, "1305년 가을, 주민 80명"]) for (const playable of [true, false]) for (const choosingHouse of [false, true]) {
    assert.equal(welcomeClickCloses({ continueLine, choosingHouse, playable, scripted: false }), false, JSON.stringify({ continueLine, playable, choosingHouse }));
  }
  // A scripted run (the proof query, a pinned map number) still closes it by a click, keeping its injected scene — never over a save.
  assert.equal(welcomeClickCloses({ continueLine: null, choosingHouse: false, playable: true, scripted: true }), true);
  assert.equal(welcomeClickCloses({ continueLine: "1305년 가을", choosingHouse: false, playable: true, scripted: true }), false);
});

test("the welcome opens on every load for a player, even one who closed it before; only a scripted run that stored it skips it", () => {
  assert.equal(welcomeOpensOnLoad(false, false), true);
  assert.equal(welcomeOpensOnLoad(true, false), true, "a player who once closed it, with no save, still chooses a mode");
  assert.equal(welcomeOpensOnLoad(false, true), true);
  assert.equal(welcomeOpensOnLoad(true, true), false);
});

test("영주 모드로 시작 starts with the town's agency; 샌드박스로 시작 without (the player builds)", () => {
  const markup = welcome();
  assert.match(markup, new RegExp(`data-scenario="${LORD_SLICE_SCENARIO_ID}"`));
  assert.match(markup, new RegExp(`data-scenario="${SANDBOX_SCENARIO_ID}"`));
  assert.notEqual(started(LORD_SLICE_SCENARIO_ID).agency, undefined);
  assert.equal(started(SANDBOX_SCENARIO_ID).agency, undefined);
  assert.equal(DEFAULT_GAME_STATE.agency, undefined, "the state behind the welcome builds nothing by itself — a mode must be chosen");
});

test("each mode's line says who builds: the town by itself in lord mode, the player building by building otherwise", () => {
  assert.equal(TUTORIAL_COPY.modeLines.lord_slice, "도시가 스스로 자랍니다. 영주는 방침과 판결만 내립니다.");
  assert.equal(TUTORIAL_COPY.modeLines.sandbox, "건물을 직접 하나하나 짓습니다.");
  assert.match(TUTORIAL_COPY.modeLines.campaign_market_town, /^건물을 직접 하나하나 짓습니다\./);
  const markup = welcome();
  assert.ok(markup.includes(TUTORIAL_COPY.modeLines.lord_slice));
  assert.ok(markup.includes(TUTORIAL_COPY.modeLines.sandbox));
});

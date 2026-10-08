/**
 * LM-R3 (HOUSE-1, MNR-3): the new game's house choice — the twenty names with their Korean readings, the arms drawn per
 * name (the default house's own first), the start commands that carry the house and the mode, and the chosen house as
 * the lord's first house on the screens that read it (the lordship screen, the home petition's roundel, the chronicle).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GENTRY_NAMES_KO } from "../src/content/gentryNames";
import { DEFAULT_PLAYER_HOUSE, LORD_HOUSE_NAMES } from "../src/content/lordshipConfig";
import { RIVERSIDE_ARCHETYPE_ID, FEN_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import { armsHeraldrySeed, lordHouseByOrder } from "../src/engine/lordshipState";
import { MANOR_HOUSEHOLD } from "../src/engine/persons.types";
import { lordMode } from "../src/engine/townAgency";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { recordArt } from "../src/ui/chronicle/chronicleScreenModel";
import { armsKey, armsRecipe } from "../src/ui/heraldry/heraldry";
import {
  ARMS_PAGE_SIZE, DEFAULT_HOUSE_CHOICE, armsCandidate, armsCandidates, chooseHouseName, houseArmsRecipe, houseNameKey, houseNames, type HouseChoice,
} from "../src/ui/houseChoice";
import { HOUSE_CHOICE_COPY } from "../src/ui/houseChoiceCopy.ko";
import { landStartCommand } from "../src/ui/landChoice";
import { lordshipView } from "../src/ui/lordshipModel";
import { lordHouseArms } from "../src/ui/persons/personModels";
import { HouseChoicePanel } from "../src/ui/screens/HouseChoice";
import { WelcomeParchment } from "../src/ui/screens/WelcomeScreen";

const CHOSEN: HouseChoice = { name: "de Ravenholt", arms: "ravenholt-3" };
const panel = (house: HouseChoice) => renderToStaticMarkup(createElement(HouseChoicePanel, {
  house, onHouse: () => undefined, onStart: () => undefined, onBack: () => undefined,
}));
const welcome = () => renderToStaticMarkup(createElement(WelcomeParchment, {
  onDismiss: () => undefined, continueLine: null, archiveNotice: null, onContinue: () => undefined, onNewGame: () => undefined,
  onChooseMode: () => undefined, tutorialEnabled: true, onTutorialChange: () => undefined, initialLand: { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 1 },
}));
/** The markup's visible text: tags and the period spelling (`<small lang="en">`) removed. */
const visibleKorean = (markup: string) => markup.replace(/<small[^>]*lang="en"[^>]*>[^<]*<\/small>/g, "").replace(/<[^>]+>/g, " ");

test("the twenty names in the lordship's order, each with its Korean reading; de Haverel and its arms by default", () => {
  assert.deepEqual(houseNames().map(entry => entry.name), [...LORD_HOUSE_NAMES]);
  assert.equal(houseNames().length, 20);
  for (const entry of houseNames()) assert.equal(entry.ko, GENTRY_NAMES_KO[entry.name], entry.name);
  assert.deepEqual(DEFAULT_HOUSE_CHOICE, { name: DEFAULT_PLAYER_HOUSE.name, arms: DEFAULT_PLAYER_HOUSE.arms });
  assert.deepEqual(DEFAULT_HOUSE_CHOICE, { name: "de Haverel", arms: "haverel" });
});

test("arms candidates are ids per name, deterministic; the default house's own arms come first", () => {
  assert.equal(houseNameKey("de Haverel"), "haverel");
  assert.equal(houseNameKey("de Montgarnier"), "montgarnier");
  assert.equal(houseNameKey("Fitzaldric"), "fitzaldric");
  assert.deepEqual(armsCandidates("de Haverel", 0), ["haverel", "haverel-2", "haverel-3", "haverel-4"]);
  assert.deepEqual(armsCandidates("de Haverel", 1), ["haverel-5", "haverel-6", "haverel-7", "haverel-8"]);
  assert.equal(armsCandidates("Fitzosric", 0).length, ARMS_PAGE_SIZE);
  assert.deepEqual(chooseHouseName("de Haverel"), DEFAULT_HOUSE_CHOICE);
  assert.deepEqual(chooseHouseName("de Ravenholt"), { name: "de Ravenholt", arms: armsCandidate("de Ravenholt", 0) });
  // Every name's candidates are distinct ids; the arms are the lordship's recipe for the player's house.
  const ids = LORD_HOUSE_NAMES.flatMap(name => [0, 1].flatMap(page => armsCandidates(name, page)));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(houseArmsRecipe("haverel"), armsRecipe(armsHeraldrySeed("haverel"), MANOR_HOUSEHOLD));
  // Drawn, not fixed: one page's four arms are not all the same.
  assert.ok(new Set(armsCandidates("de Haverel", 0).map(arms => armsKey(houseArmsRecipe(arms)))).size > 1);
});

test("the start commands carry the house and the mode", () => {
  const riverside = { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 1 };
  const fen = { archetypeId: FEN_ARCHETYPE_ID, seed: 4242 };
  assert.deepEqual(landStartCommand(LORD_SLICE_SCENARIO_ID, fen, false, CHOSEN),
    { type: "start_new_game", scenarioId: LORD_SLICE_SCENARIO_ID, mode: "lord", house: CHOSEN, seed: 4242 });
  assert.deepEqual(landStartCommand(SANDBOX_SCENARIO_ID, riverside, false, CHOSEN),
    { type: "start_new_game", scenarioId: SANDBOX_SCENARIO_ID, mode: "sandbox", house: CHOSEN });
  assert.deepEqual(landStartCommand(DEFAULT_SCENARIO_ID, fen, true, CHOSEN),
    { type: "start_new_game", scenarioId: DEFAULT_SCENARIO_ID, mode: "sandbox", house: CHOSEN, archetypeId: FEN_ARCHETYPE_ID, seed: 4242 });
  // Today's game (the campaign, the riverside on map 1, the default house) is the current state: no command.
  assert.equal(landStartCommand(DEFAULT_SCENARIO_ID, riverside, false), null);
  assert.equal(landStartCommand(DEFAULT_SCENARIO_ID, riverside, false, DEFAULT_HOUSE_CHOICE), null);
  // Another house on today's game is a new game.
  assert.deepEqual(landStartCommand(DEFAULT_SCENARIO_ID, riverside, false, CHOSEN),
    { type: "start_new_game", scenarioId: DEFAULT_SCENARIO_ID, mode: "sandbox", house: CHOSEN });
  assert.deepEqual(landStartCommand(LORD_SLICE_SCENARIO_ID, riverside, false)?.house, DEFAULT_HOUSE_CHOICE);
});

test("a game's lordship house order 1 is the chosen name and arms, in every mode; de Haverel by default", () => {
  const riverside = { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 7 };
  for (const scenarioId of [LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID, DEFAULT_SCENARIO_ID]) {
    const state = gameReducer(DEFAULT_GAME_STATE, landStartCommand(scenarioId, riverside, true, CHOSEN)!);
    assert.equal(state.scenarioId, scenarioId);
    assert.equal(lordMode(state), scenarioId === LORD_SLICE_SCENARIO_ID, scenarioId);
    const first = lordHouseByOrder(state, 1)!;
    assert.deepEqual({ name: first.name, arms: first.arms, heraldrySeed: first.heraldrySeed },
      { name: CHOSEN.name, arms: CHOSEN.arms, heraldrySeed: armsHeraldrySeed(CHOSEN.arms) }, scenarioId);
    const fallback = gameReducer(DEFAULT_GAME_STATE, landStartCommand(scenarioId, riverside, true)!);
    assert.deepEqual([lordHouseByOrder(fallback, 1)!.name, lordHouseByOrder(fallback, 1)!.arms], ["de Haverel", "haverel"], scenarioId);
  }
});

test("the chosen house shows on the lordship screen, the home petition's roundel arms and the chronicle", () => {
  const state = gameReducer(DEFAULT_GAME_STATE, landStartCommand(LORD_SLICE_SCENARIO_ID, { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 7 }, false, CHOSEN)!);
  const arms = { kind: "arms", recipe: houseArmsRecipe(CHOSEN.arms) };
  // The home petition's roundel draws `lordHouseArms` (lordCardsModel.homePetitionView, LR1-D5).
  assert.deepEqual(lordHouseArms(state), arms);
  const lordship = lordshipView(state as GameState);
  assert.deepEqual(lordship.arms, arms);
  assert.match(lordship.house, new RegExp(GENTRY_NAMES_KO[CHOSEN.name]!));
  assert.doesNotMatch(lordship.house, /[A-Za-z]/);
  const arrived = { id: "h1", tick: 0, kind: "faction", template: "house.arrived", params: { order: 1 } } as unknown as HistoryRecord;
  assert.deepEqual(recordArt(state, arrived), { kind: "emblem", emblem: arms });
});

test("the panel: the names in Korean with the Latin small beside, the chosen arms large, four candidates, one primary", () => {
  const markup = panel(CHOSEN);
  const names = [...markup.matchAll(/<button class="welcome-house-name[^"]*"[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0]);
  assert.equal(names.length, 20);
  for (const [at, button] of names.entries()) {
    const name = LORD_HOUSE_NAMES[at]!;
    assert.ok(button.includes(`<span class="welcome-house-name-ko">${GENTRY_NAMES_KO[name]}</span>`), name);
    assert.ok(button.includes(`<small class="welcome-house-name-latin" lang="en">${name}</small>`), name);
    assert.match(button, new RegExp(`aria-pressed="${name === CHOSEN.name}"`), name);
  }
  // No Latin-only name: with the period spelling removed, no Latin letter is left to read.
  assert.doesNotMatch(visibleKorean(markup), /[A-Za-z]/);
  const candidates = [...markup.matchAll(/data-arms-candidate="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(candidates, armsCandidates(CHOSEN.name, 0));
  assert.match(markup, /data-arms-candidate="ravenholt-3"[^>]*>|aria-pressed="true"[^>]*data-arms-candidate="ravenholt-3"/);
  assert.ok(markup.includes(HOUSE_CHOICE_COPY.moreArms));
  assert.equal(markup.match(/ui-btn--primary/g)?.length, 1, "one primary: the start");
  assert.match(markup, /<button[^>]*ui-btn--primary[^>]*data-house-start/);
  assert.doesNotMatch(markup, /\stitle="/);
});

test("the welcome: the logo heads it; lord mode the one primary, the sandbox secondary with its goal option inside", () => {
  const markup = welcome();
  assert.match(markup, /<h2 class="welcome-logo">/);
  const modes = [...markup.matchAll(/<button[^>]*data-scenario="([^"]+)"[^>]*>/g)];
  assert.deepEqual(modes.map(match => match[1]), [LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID]);
  assert.match(modes[0]![0], /ui-btn--primary/);
  assert.doesNotMatch(modes[1]![0], /ui-btn--primary/);
  assert.equal(markup.match(/ui-btn--primary/g)?.length, 1);
  // "목표와 함께" sits in the sandbox's group, off at first (the campaign is one switch away).
  const sandbox = markup.slice(markup.indexOf('data-mode="sandbox"'));
  assert.match(sandbox, /role="switch" aria-checked="false" class="tutorial-switch welcome-goal-switch[^"]*" data-sandbox-goal/);
  assert.ok(sandbox.includes("목표와 함께"));
  // The house step comes after a mode press (not on the first screen).
  assert.doesNotMatch(markup, /welcome-house/);
});

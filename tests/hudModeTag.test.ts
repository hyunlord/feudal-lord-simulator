/**
 * WEL-D1 (user 2026-10-11): the HUD says which mode the game is in once it has started — a tag at the status pill's head,
 * "영주 모드" when the town builds by itself (lord mode), "직접 짓기" when the player builds (the sandbox and the goal
 * campaign). A tag, not a control: the pill's cells keep their order (the date first) for every script that picks them.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RIVERSIDE_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { StatusPill } from "../src/ui/hud/HudShell";
import { HUD_COPY } from "../src/ui/hud/hudCopy.ko";
import { statusPillModel } from "../src/ui/hud/statusPillModel";
import { DEFAULT_HOUSE_CHOICE } from "../src/ui/houseChoice";
import { landStartCommand } from "../src/ui/landChoice";

const started = (scenarioId: string): GameState => {
  const command = landStartCommand(scenarioId, { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 2 }, false, DEFAULT_HOUSE_CHOICE);
  return command === null ? DEFAULT_GAME_STATE : gameReducer(DEFAULT_GAME_STATE, command);
};
const pill = (state: GameState) => renderToStaticMarkup(createElement(StatusPill, { state, model: statusPillModel(state), onOpenLedger: () => undefined,
  onOpenPopulation: () => undefined, onInspect: () => undefined }));
const tag = (markup: string) => markup.match(/<span class="status-pill-mode" data-mode="([a-z]+)" role="img" aria-label="([^"]*)" tabindex="-?[01]"/);
const words = (markup: string) => markup.match(/status-pill-mode-words[^>]*>([^<]*)</)?.[1];
const icon = (markup: string) => markup.match(/status-pill-mode-icon[^>]*>(.{0,80})/)?.[1] ?? "";

test("lord mode's pill opens with 영주 모드; the sandbox's and the goal campaign's with 직접 짓기", () => {
  assert.deepEqual(tag(pill(started(LORD_SLICE_SCENARIO_ID)))?.slice(1), ["lord", HUD_COPY.mode.lord]);
  assert.deepEqual(tag(pill(started(SANDBOX_SCENARIO_ID)))?.slice(1), ["build", HUD_COPY.mode.build]);
  assert.deepEqual(tag(pill(started(DEFAULT_SCENARIO_ID)))?.slice(1), ["build", HUD_COPY.mode.build]);
  assert.equal(HUD_COPY.mode.lord, "영주 모드");
  assert.equal(HUD_COPY.mode.build, "직접 짓기");
  // Its words (from 1101 px wide) and its picture (1024 and narrower: the stylesheet shows one or the other) — the seal for
  // lord mode, the build dock's tools for building; its name is the whole words at every width.
  assert.equal(words(pill(started(LORD_SLICE_SCENARIO_ID))), "영주 모드");
  assert.equal(words(pill(started(SANDBOX_SCENARIO_ID))), "직접 짓기");
  assert.match(icon(pill(started(LORD_SLICE_SCENARIO_ID))), /seal-mark/);
  assert.doesNotMatch(icon(pill(started(SANDBOX_SCENARIO_ID))), /seal-mark/);
});

test("the tag is the pill's first child and no control; the cells keep their order, the date first", () => {
  for (const state of [started(LORD_SLICE_SCENARIO_ID), started(SANDBOX_SCENARIO_ID)]) {
    const markup = pill(state);
    assert.match(markup, /^<nav class="status-pill"[^>]*><span class="status-pill-mode"/);
    assert.doesNotMatch(markup, /<button[^>]*status-pill-mode/);
    const cells = [...markup.matchAll(/<button[^>]*class="([^"]*status-pill-cell[^"]*)"/g)].map(match => match[1]!);
    assert.match(cells[0]!, /status-pill-date/, "the date stays the first cell");
  }
});

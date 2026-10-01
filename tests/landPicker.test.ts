/**
 * LAND-UI (LU-D7): the new-game screen's land choice — the five lands in mapArchetypes() order with the riverside
 * picked by default, the seed control (1–5, fixed at 1 on the riverside), the command each start sends, and each land's
 * preview raster (deterministic, canonical colours, the river and the village where the state has them).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CANONICAL_PALETTE, PALETTE, RAMPS } from "../src/content/palette";
import { FEN_ARCHETYPE_ID, MAP_ARCHETYPE_IDS, RIVERSIDE_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { DEFAULT_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { SCENARIO_COPY } from "../src/content/scenario/scenarioCopy.ko";
import { gameReducer, DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import {
  LAND_SEED_MAX, LAND_SEED_MIN, canStepLandSeed, chooseLand, defaultLandChoice, isDefaultLand, landSeedLocked, landStartCommand, stepLandSeed,
} from "../src/ui/landChoice";
import { LAND_PREVIEW_SCALE, cachedLandPreview, landPreviewPixels } from "../src/ui/landPreview";
import { WelcomeParchment } from "../src/ui/screens/WelcomeScreen";

const channels = (hex: string) => [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16)).join(",");
const pixelAt = (pixels: { width: number; data: Uint8ClampedArray }, tx: number, ty: number) => {
  const at = ((ty * LAND_PREVIEW_SCALE + 1) * pixels.width + tx * LAND_PREVIEW_SCALE + 1) * 4;
  return [pixels.data[at], pixels.data[at + 1], pixels.data[at + 2]].join(",");
};

test("the default choice is the riverside town on map 1, and only its seed is fixed", () => {
  const choice = defaultLandChoice();
  assert.deepEqual(choice, { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 1 });
  assert.equal(MAP_ARCHETYPE_IDS[0], RIVERSIDE_ARCHETYPE_ID);
  assert.equal(isDefaultLand(choice), true);
  assert.deepEqual(MAP_ARCHETYPE_IDS.filter(landSeedLocked), [RIVERSIDE_ARCHETYPE_ID]);
});

test("the seed control clamps to 1–5 and is disabled on the riverside", () => {
  const riverside = defaultLandChoice();
  assert.equal(canStepLandSeed(riverside, 1), false);
  assert.equal(canStepLandSeed(riverside, -1), false);
  assert.deepEqual(stepLandSeed(riverside, 1), riverside);
  let fen = chooseLand(riverside, FEN_ARCHETYPE_ID);
  assert.deepEqual(fen, { archetypeId: FEN_ARCHETYPE_ID, seed: 1 });
  assert.equal(canStepLandSeed(fen, -1), false);
  for (let press = 0; press < 8; press += 1) fen = stepLandSeed(fen, 1);
  assert.equal(fen.seed, LAND_SEED_MAX);
  assert.equal(canStepLandSeed(fen, 1), false);
  assert.equal(canStepLandSeed(fen, -1), true);
  for (let press = 0; press < 8; press += 1) fen = stepLandSeed(fen, -1);
  assert.equal(fen.seed, LAND_SEED_MIN);
  // A pick keeps the seed, except on the riverside (map 1 only).
  const fenThree = { archetypeId: FEN_ARCHETYPE_ID, seed: 3 };
  assert.equal(chooseLand(fenThree, MAP_ARCHETYPE_IDS[2]!).seed, 3);
  assert.deepEqual(chooseLand(fenThree, RIVERSIDE_ARCHETYPE_ID), riverside);
});

test("a start sends nothing for the campaign on the riverside's map 1, and the land and seed for any other land", () => {
  const riverside = defaultLandChoice();
  assert.equal(landStartCommand(DEFAULT_SCENARIO_ID, riverside, false), null);
  assert.deepEqual(landStartCommand(SANDBOX_SCENARIO_ID, riverside, false), { type: "start_new_game", scenarioId: SANDBOX_SCENARIO_ID });
  assert.deepEqual(landStartCommand(DEFAULT_SCENARIO_ID, riverside, true), { type: "start_new_game", scenarioId: DEFAULT_SCENARIO_ID });
  const fen = { archetypeId: FEN_ARCHETYPE_ID, seed: 3 };
  for (const [scenarioId, overSave] of [[DEFAULT_SCENARIO_ID, false], [DEFAULT_SCENARIO_ID, true], [SANDBOX_SCENARIO_ID, false]] as const) {
    const command = landStartCommand(scenarioId, fen, overSave);
    assert.deepEqual(command, { type: "start_new_game", scenarioId, archetypeId: FEN_ARCHETYPE_ID, seed: 3 });
    const next = gameReducer(DEFAULT_GAME_STATE, command!);
    assert.equal(next.archetypeId, FEN_ARCHETYPE_ID);
    assert.equal(next.seed, 3);
    assert.equal(next.scenarioId, scenarioId);
    assert.equal(next.agency, undefined, "the welcome never passes `mode`");
  }
  // Every land and seed the picker offers is a state the engine makes.
  for (const archetypeId of MAP_ARCHETYPE_IDS) for (let seed = LAND_SEED_MIN; seed <= LAND_SEED_MAX; seed += 1) {
    const choice = stepLandSeed(chooseLand(riverside, archetypeId), seed - 1);
    const command = landStartCommand(DEFAULT_SCENARIO_ID, choice, true)!;
    assert.notEqual(newGameState(command), null, `${archetypeId} seed ${choice.seed}`);
  }
});

test("each land's preview is deterministic, 2 px a tile and drawn in canonical colours", () => {
  const canonical = new Set<string>(CANONICAL_PALETTE.map(channels));
  for (const archetypeId of MAP_ARCHETYPE_IDS) {
    const seed = landSeedLocked(archetypeId) ? 1 : 2;
    const first = landPreviewPixels(archetypeId, seed)!;
    const second = landPreviewPixels(archetypeId, seed)!;
    assert.equal(first.width, DEFAULT_GAME_STATE.width * LAND_PREVIEW_SCALE);
    assert.equal(first.height, DEFAULT_GAME_STATE.height * LAND_PREVIEW_SCALE);
    assert.deepEqual(first.data, second.data, archetypeId);
    // Every tile's lower-right pixel is its colour unshaded (a decal darkens only the upper-left one).
    for (let ty = 0; ty < DEFAULT_GAME_STATE.height; ty += 1) for (let tx = 0; tx < DEFAULT_GAME_STATE.width; tx += 1) {
      assert.ok(canonical.has(pixelAt(first, tx, ty)), `${archetypeId} (${tx},${ty}) ${pixelAt(first, tx, ty)}`);
    }
  }
  // LM-E5: the engine builds the riverside on any seed now (seed 1 is today's map); the picker still fixes it at 1 (LU-D7)
  // until its seed control follows LM-E5, so a seed-2 preview exists but is never asked for.
  assert.notEqual(landPreviewPixels(RIVERSIDE_ARCHETYPE_ID, 2), null, "the engine builds the riverside on seed 2 (LM-E5)");
  assert.equal(landPreviewPixels("core:nowhere", 1), null);
  assert.equal(cachedLandPreview(FEN_ARCHETYPE_ID, 2), cachedLandPreview(FEN_ARCHETYPE_ID, 2));
});

test("the riverside preview shows its river, its fords, the village's roads and buildings", () => {
  const state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 1 })!;
  const pixels = landPreviewPixels(RIVERSIDE_ARCHETYPE_ID, 1)!;
  const tile = (index: number) => pixelAt(pixels, index % state.width, Math.floor(index / state.width));
  const fords = new Set(state.river?.fords ?? []);
  const river = (state.river?.cells ?? []).filter(index => !fords.has(index) && !state.tiles[index]!.hasRoad && state.tiles[index]!.buildingId === null);
  assert.ok(river.length > 0);
  for (const index of river) assert.equal(tile(index), channels(RAMPS.water[4]));
  for (const index of [...fords].filter(at => !state.tiles[at]!.hasRoad)) assert.equal(tile(index), channels(RAMPS.water[5]));
  const built = state.tiles.findIndex(candidate => candidate.buildingId !== null);
  const road = state.tiles.findIndex(candidate => candidate.hasRoad && candidate.buildingId === null);
  assert.equal(tile(built), channels(PALETTE.vermilion));
  assert.equal(tile(road), channels(RAMPS.earth[4]));
});

test("the welcome offers the five lands above the mode buttons; the mode buttons are unchanged", () => {
  const markup = renderToStaticMarkup(createElement(WelcomeParchment, {
    onDismiss: () => undefined, continueLine: null, archiveNotice: null, onContinue: () => undefined,
    onNewGame: () => undefined, onChooseMode: () => undefined, tutorialEnabled: true, onTutorialChange: () => undefined,
  }));
  const lands = [...markup.matchAll(/<button class="welcome-land[^"]*"[^>]*>/g)].map(match => match[0]);
  assert.equal(lands.length, 5);
  assert.deepEqual(lands.map(button => button.match(/data-archetype="([^"]+)"/)?.[1]), [...MAP_ARCHETYPE_IDS]);
  assert.deepEqual(lands.map(button => button.match(/aria-pressed="(true|false)"/)?.[1]), ["true", "false", "false", "false", "false"]);
  assert.ok(lands.every(button => !button.includes("data-scenario")));
  assert.ok(markup.indexOf(SCENARIO_COPY.archetypePrompt) < markup.indexOf("data-scenario"), "the lands come before the modes");
  for (const land of Object.values(SCENARIO_COPY.archetypes)) {
    assert.ok(markup.includes(land.name));
    assert.ok(markup.includes(land.description));
  }
  assert.deepEqual([...markup.matchAll(/data-scenario="([^"]+)"/g)].map(match => match[1]), [DEFAULT_SCENARIO_ID, SANDBOX_SCENARIO_ID]);
  assert.match(markup, /목표형으로 시작/);
  // The riverside is picked: both seed buttons are disabled (aria-disabled: an enabled, isolated button never lets
  // the press fall through to the dismiss layer), the seed reads 1.
  const steps = [...markup.matchAll(/<button[^>]*class="welcome-seed-step[^"]*"[^>]*>/g)].map(match => match[0]);
  assert.equal(steps.length, 2);
  assert.ok(steps.every(button => button.includes('aria-disabled="true"') && !/\sdisabled=""/.test(button)));
  assert.match(markup, /<span class="welcome-seed-value"[^>]*>1<\/span>/);
  assert.match(markup, /class="welcome-parchment welcome-parchment--lands"/);
});

/**
 * LAND-UI (LU-D7) + NAT-4: the new-game screen's land choice — the five lands in mapArchetypes() order with the
 * riverside picked by default on a random map number (LM-E5), the number field (1–999,999 on every land, the riverside
 * too), the reason a number cannot start, the command each start sends, and each land's preview raster (deterministic,
 * canonical colours, the river and the village where the state has them).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CANONICAL_PALETTE, PALETTE, RAMPS } from "../src/content/palette";
import { FEN_ARCHETYPE_ID, MAP_ARCHETYPE_IDS, RIVERSIDE_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { lordMode } from "../src/engine/townAgency";
import { SCENARIO_COPY } from "../src/content/scenario/scenarioCopy.ko";
import { gameReducer, DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { NEW_GAME_SEED_MAX, newGameState } from "../src/state/newGame";
import {
  LAND_SEED_DIGITS, LAND_SEED_MAX, LAND_SEED_MIN, PIN_SEED_QUERY, chooseLand, defaultLandChoice, initialLandChoice, isDefaultLand, landPlayable,
  landSeedProblem, landSeedText, landStartCommand, parseLandSeed, randomLandSeed, type LandChoice,
} from "../src/ui/landChoice";
import { LAND_PICKER_COPY } from "../src/ui/landPickerCopy.ko";
import { LAND_PREVIEW_SCALE, PREVIEW_LIMIT, cachedLandPreview, landPreviewCacheSize, landPreviewPixels } from "../src/ui/landPreview";
import { numberFieldDigits } from "../src/ui/kit";
import { WelcomeParchment } from "../src/ui/screens/WelcomeScreen";

const channels = (hex: string) => [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16)).join(",");
const pixelAt = (pixels: { width: number; data: Uint8ClampedArray }, tx: number, ty: number) => {
  const at = ((ty * LAND_PREVIEW_SCALE + 1) * pixels.width + tx * LAND_PREVIEW_SCALE + 1) * 4;
  return [pixels.data[at], pixels.data[at + 1], pixels.data[at + 2]].join(",");
};
/** A riverside map number with no game (no legal site for the village: newGameState → null). */
const UNBUILDABLE_RIVERSIDE = 118;
/** A fixed `random` whose first draw in randomNewGameSeed is `seed`. */
const randomAt = (seed: number) => () => (seed - 1 + 0.5) / NEW_GAME_SEED_MAX;
const welcome = (initialLand?: LandChoice) => renderToStaticMarkup(createElement(WelcomeParchment, {
  onDismiss: () => undefined, continueLine: null, archiveNotice: null, onContinue: () => undefined,
  onNewGame: () => undefined, onChooseMode: () => undefined, tutorialEnabled: true, onTutorialChange: () => undefined, initialLand,
}));
const modeButtons = (markup: string) => [...markup.matchAll(/<button[^>]*data-scenario="[^"]+"[^>]*>/g)].map(match => match[0]);

test("the map number is digits only, 1 to 999,999, six digits at most", () => {
  assert.equal(LAND_SEED_MIN, 1);
  assert.equal(LAND_SEED_MAX, NEW_GAME_SEED_MAX);
  assert.equal(LAND_SEED_DIGITS, 6);
  for (const [text, seed] of [["1", 1], ["999999", 999_999], ["000123", 123], ["42", 42]] as const) assert.equal(parseLandSeed(text), seed, text);
  for (const text of ["", "0", "000000", "1000000", "12a", "-3", " 12", "1.5", "1e3"]) assert.equal(parseLandSeed(text), null, text);
  assert.equal(landSeedText(482_913), "482913");
  assert.equal(landSeedText(null), "");
  // The kit field keeps only the digits of a keystroke or a paste, at most six.
  assert.equal(numberFieldDigits("12a3", 6), "123");
  assert.equal(numberFieldDigits("x2 3,456-789", 6), "234567");
  assert.equal(numberFieldDigits("", 6), "");
});

test("the welcome opens on the riverside with a random map number that has a game; a query pins it, the proof query pins map 1", () => {
  const drawn = initialLandChoice("", randomAt(482_913));
  assert.deepEqual(drawn, { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 482_913 });
  assert.equal(landPlayable(drawn), true);
  // An unbuildable first draw moves on to the next number that has a game.
  const skipped = initialLandChoice("", randomAt(UNBUILDABLE_RIVERSIDE));
  assert.ok(skipped.seed !== null && skipped.seed > UNBUILDABLE_RIVERSIDE && landPlayable(skipped), `${skipped.seed}`);
  assert.deepEqual(initialLandChoice(`?${PIN_SEED_QUERY}=777`), { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 777 });
  assert.deepEqual(initialLandChoice(`?phase10-proof=1&${PIN_SEED_QUERY}=777`), { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 777 });
  // Scripted scenes and replays (the proof query) open on today's map: dismissing keeps the injected state.
  assert.deepEqual(initialLandChoice("?phase10-proof=1&story-delay=600000"), defaultLandChoice());
  assert.deepEqual(defaultLandChoice(), { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 1 });
  assert.equal(landStartCommand(DEFAULT_SCENARIO_ID, initialLandChoice("?phase10-proof=1"), false), null);
  // A pin that is not a map number is ignored (random again).
  assert.deepEqual(initialLandChoice(`?${PIN_SEED_QUERY}=0`, randomAt(5)), { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 5 });
  assert.equal(MAP_ARCHETYPE_IDS[0], RIVERSIDE_ARCHETYPE_ID);
});

test("every land takes every number: a pick keeps the number, 무작위 draws one that has a game on the chosen land", () => {
  const fen = chooseLand({ archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 482_913 }, FEN_ARCHETYPE_ID);
  assert.deepEqual(fen, { archetypeId: FEN_ARCHETYPE_ID, seed: 482_913 });
  assert.deepEqual(chooseLand(fen, RIVERSIDE_ARCHETYPE_ID), { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 482_913 });
  assert.deepEqual(chooseLand({ archetypeId: FEN_ARCHETYPE_ID, seed: null }, RIVERSIDE_ARCHETYPE_ID), { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: null });
  for (const archetypeId of MAP_ARCHETYPE_IDS) {
    const next = randomLandSeed({ archetypeId, seed: 3 }, randomAt(UNBUILDABLE_RIVERSIDE));
    assert.equal(next.archetypeId, archetypeId);
    assert.ok(next.seed !== null && next.seed >= UNBUILDABLE_RIVERSIDE && landPlayable(next), `${archetypeId} ${next.seed}`);
    assert.notEqual(newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId, seed: next.seed! }), null);
  }
  // Only the riverside skips 118 (its map has no site for the village); the other lands take it.
  assert.equal(randomLandSeed({ archetypeId: FEN_ARCHETYPE_ID, seed: 1 }, randomAt(UNBUILDABLE_RIVERSIDE)).seed, UNBUILDABLE_RIVERSIDE);
});

test("a number that cannot start says why: none typed or out of range, or no game on that land's map", () => {
  assert.equal(landSeedProblem({ archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: null }), "range");
  assert.equal(newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: UNBUILDABLE_RIVERSIDE }), null);
  assert.equal(landSeedProblem({ archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: UNBUILDABLE_RIVERSIDE }), "unbuildable");
  assert.equal(landSeedProblem({ archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 1 }), null);
  assert.equal(landSeedProblem({ archetypeId: FEN_ARCHETYPE_ID, seed: UNBUILDABLE_RIVERSIDE }), null);
  assert.equal(landSeedProblem({ archetypeId: "core:nowhere", seed: 1 }), "unbuildable");
  // Asked again (every render while typing) it is the same answer.
  assert.equal(landSeedProblem({ archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: UNBUILDABLE_RIVERSIDE }), "unbuildable");
  for (const problem of ["range", "unbuildable"] as const) assert.match(LAND_PICKER_COPY.problems[problem], /[가-힯]/);
});

test("a start sends nothing for the campaign on the riverside's map 1, and the land and number for any other choice", () => {
  const riverside = defaultLandChoice();
  assert.equal(isDefaultLand(riverside), true);
  assert.equal(isDefaultLand({ archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 2 }), false);
  assert.equal(isDefaultLand({ archetypeId: FEN_ARCHETYPE_ID, seed: 1 }), false);
  assert.equal(landStartCommand(DEFAULT_SCENARIO_ID, riverside, false), null);
  assert.deepEqual(landStartCommand(SANDBOX_SCENARIO_ID, riverside, false), { type: "start_new_game", scenarioId: SANDBOX_SCENARIO_ID });
  assert.deepEqual(landStartCommand(DEFAULT_SCENARIO_ID, riverside, true), { type: "start_new_game", scenarioId: DEFAULT_SCENARIO_ID });
  const choices: readonly LandChoice[] = [
    { archetypeId: FEN_ARCHETYPE_ID, seed: 3 }, { archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 482_913 }, { archetypeId: MAP_ARCHETYPE_IDS[2]!, seed: 999_999 },
  ];
  for (const choice of choices) for (const [scenarioId, overSave] of [[DEFAULT_SCENARIO_ID, false], [DEFAULT_SCENARIO_ID, true], [SANDBOX_SCENARIO_ID, false]] as const) {
    const command = landStartCommand(scenarioId, choice, overSave);
    assert.deepEqual(command, { type: "start_new_game", scenarioId, archetypeId: choice.archetypeId, seed: choice.seed });
    const next = gameReducer(DEFAULT_GAME_STATE, command!);
    assert.equal(next.seed, choice.seed, `${choice.archetypeId} ${choice.seed}`);
    assert.equal(next.scenarioId, scenarioId);
    assert.equal(next.agency, undefined, "the welcome never passes `mode`");
    if (choice.archetypeId !== RIVERSIDE_ARCHETYPE_ID) assert.equal(next.archetypeId, choice.archetypeId);
  }
});

test("each land's preview is deterministic, 2 px a tile and drawn in canonical colours; the cache is bounded", () => {
  const canonical = new Set<string>(CANONICAL_PALETTE.map(channels));
  for (const archetypeId of MAP_ARCHETYPE_IDS) {
    const first = landPreviewPixels(archetypeId, 2)!;
    const second = landPreviewPixels(archetypeId, 2)!;
    assert.equal(first.width, DEFAULT_GAME_STATE.width * LAND_PREVIEW_SCALE);
    assert.equal(first.height, DEFAULT_GAME_STATE.height * LAND_PREVIEW_SCALE);
    assert.deepEqual(first.data, second.data, archetypeId);
    // Every tile's lower-right pixel is its colour unshaded (a decal darkens only the upper-left one).
    for (let ty = 0; ty < DEFAULT_GAME_STATE.height; ty += 1) for (let tx = 0; tx < DEFAULT_GAME_STATE.width; tx += 1) {
      assert.ok(canonical.has(pixelAt(first, tx, ty)), `${archetypeId} (${tx},${ty}) ${pixelAt(first, tx, ty)}`);
    }
  }
  assert.equal(landPreviewPixels("core:nowhere", 1), null);
  assert.equal(landPreviewPixels(RIVERSIDE_ARCHETYPE_ID, UNBUILDABLE_RIVERSIDE), null, "no picture for a number with no game");
  assert.equal(cachedLandPreview(FEN_ARCHETYPE_ID, 2), cachedLandPreview(FEN_ARCHETYPE_ID, 2));
  // NAT-4: any of 999,999 numbers per land, so the cache keeps the newest PREVIEW_LIMIT pictures.
  for (let seed = 10; seed < 10 + PREVIEW_LIMIT + 5; seed += 1) cachedLandPreview(FEN_ARCHETYPE_ID, seed);
  assert.equal(landPreviewCacheSize(), PREVIEW_LIMIT);
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
  const markup = welcome({ archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 482_913 });
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
  assert.deepEqual([...markup.matchAll(/data-scenario="([^"]+)"/g)].map(match => match[1]), [DEFAULT_SCENARIO_ID, SANDBOX_SCENARIO_ID, LORD_SLICE_SCENARIO_ID]);
  assert.match(markup, /목표형으로 시작/);
  assert.match(markup, /class="welcome-parchment welcome-parchment--lands"/);
  // NAT-4: the number is the kit field (digits, six at most, numeric keypad) beside "무작위"; no −/+ any more.
  const fields = markup.match(/<input[^>]*>/g) ?? [];
  assert.equal(fields.length, 1);
  const field = fields[0]!;
  for (const pattern of [/class="welcome-seed-field ui-number"/, /type="text"/, /inputMode="numeric"/, /maxLength="6"/, /value="482913"/]) assert.match(field, pattern);
  assert.ok(field.includes(`aria-label="${LAND_PICKER_COPY.seedField}"`));
  assert.doesNotMatch(field, /aria-invalid/);
  assert.match(markup, new RegExp(`<button class="welcome-seed-random[^"]*"[^>]*>${LAND_PICKER_COPY.random}</button>`));
  assert.doesNotMatch(markup, /welcome-seed-step|welcome-seed-value|welcome-seed-problem/);
  assert.ok(modeButtons(markup).length === 3 && modeButtons(markup).every(button => !button.includes("aria-disabled")));
});

test("a number that cannot start shows why under the field and turns the mode buttons off", () => {
  const cases = [[{ archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: UNBUILDABLE_RIVERSIDE }, "unbuildable"], [{ archetypeId: FEN_ARCHETYPE_ID, seed: null }, "range"]] as const;
  for (const [land, problem] of cases) {
    const markup = welcome(land);
    const field = markup.match(/<input[^>]*>/)![0];
    assert.match(field, /aria-invalid="true"/);
    const described = field.match(/aria-describedby="([^"]+)"/)?.[1];
    assert.ok(described !== undefined, problem);
    assert.ok(markup.includes(`<p id="${described}" class="welcome-seed-problem" role="status">${LAND_PICKER_COPY.problems[problem]}</p>`), problem);
    // aria-disabled, not disabled: an enabled, isolated button never lets the press fall through to the dismiss layer.
    assert.ok(modeButtons(markup).length === 3 && modeButtons(markup).every(button => button.includes('aria-disabled="true"') && !/\sdisabled=""/.test(button)), problem);
  }
});

test("without a query the welcome's first number is drawn at random and has a game", () => {
  const value = welcome().match(/<input[^>]*value="([0-9]*)"/)?.[1] ?? "";
  const seed = parseLandSeed(value);
  assert.ok(seed !== null && landPlayable({ archetypeId: RIVERSIDE_ARCHETYPE_ID, seed }), value);
});

test("LM-R1 (Astra B01): the start screen's lord mode starts the lord's slice on the chosen number, the riverside land", () => {
  assert.match(welcome(), new RegExp(SCENARIO_COPY.modeButtons.lord_slice));
  const command = landStartCommand(LORD_SLICE_SCENARIO_ID, { archetypeId: FEN_ARCHETYPE_ID, seed: 4242 }, false);
  assert.deepEqual(command, { type: "start_new_game", scenarioId: LORD_SLICE_SCENARIO_ID, seed: 4242 });
  const state = gameReducer(DEFAULT_GAME_STATE, command!);
  assert.equal(state.scenarioId, LORD_SLICE_SCENARIO_ID);
  assert.equal(state.seed, 4242);
  assert.ok(lordMode(state), "the slice is always lord mode");
});

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { loadSaveFile } from "../scripts/loadSaveFile";
import { admitSceneState, staleStateKeys } from "../scripts/sceneState";
// @ts-expect-error why: a plain .mjs helper for the browser scripts (no types); the test only calls its string rewrite.
import { injectSceneState } from "../scripts/sceneInjection.mjs";

// RES-REG (code review): captures and audits put a state into the game only through the save codec. The UI-KIT-1
// chronicle captures used the seed 1 determinism town, a bare pre-v12 GameState, as is: its first tick entered all
// five eras at once in 1469.
const OLD_TOWN = "fixtures/determinism/seed1/final-state.json";
const oldTown = () => JSON.parse(readFileSync(OLD_TOWN, "utf8")) as Record<string, unknown>;
const ticked = (ticks: number) => { let state = structuredClone(DEFAULT_GAME_STATE); for (let tick = 0; tick < ticks; tick += 1) state = advanceTick(state); return state; };

test("an old bare save is refused at the scene and names what it lacks", () => {
  assert.throws(() => admitSceneState(oldTown(), DEFAULT_GAME_STATE), (error: unknown) =>
    error instanceof Error && error.name === "StaleSceneStateError" && /scenarioId/.test(error.message) && /historicalEras/.test(error.message) && /loadSaveFile/.test(error.message));
});

test("the same file read through the codec enters: the chain brought it to today's schema", () => {
  const migrated = loadSaveFile(OLD_TOWN);
  assert.deepEqual(staleStateKeys(migrated, DEFAULT_GAME_STATE), []);
  assert.equal(admitSceneState(migrated, DEFAULT_GAME_STATE), migrated);
  // It entered the five eras due at 1469 when it was loaded (the migration's rule), not on a first tick after it.
  assert.equal(migrated.historicalEras?.length, 5);
});

test("current states enter unchanged: the new game, a town before and after its first ledger entry, a save envelope", () => {
  for (const state of [DEFAULT_GAME_STATE, ticked(1), ticked(1_000), ticked(3_000)]) {
    assert.deepEqual(staleStateKeys(state, DEFAULT_GAME_STATE), [], `tick ${state.tick}`);
    assert.equal(admitSceneState(state, DEFAULT_GAME_STATE), state);
  }
  const town = ticked(500);
  const envelope = JSON.parse(new TextDecoder().decode(encodeSave({ state: town, createdAt: "2026-09-27T00:00:00.000Z", savedAt: "2026-09-27T00:00:00.000Z" }).bytes));
  assert.deepEqual(admitSceneState(envelope, DEFAULT_GAME_STATE), decodeSave(encodeSave({ state: town, createdAt: "x", savedAt: "x" }).bytes).envelope.state);
});

test("a hand-built town past tick 0 that never ticked is refused: its first tick would enter every due era at once", () => {
  const { historicalEras: _eras, seasons: _seasons, persons: _persons, events: _events, ...rest } = ticked(1);
  assert.throws(() => admitSceneState({ ...rest, tick: 400_000 }, DEFAULT_GAME_STATE), { name: "StaleSceneStateError" });
});

test("the page's store starts from admitSceneState, and no script replaces the store's state another way", () => {
  const served = "import { useState } from 'react';\nconst [state, setState] = useState(DEFAULT_GAME_STATE);";
  const rewritten = injectSceneState(served, "{\"tick\":1}") as string;
  // The codec comes from /src (in every build, the trunk before included); the check is this file's own function.
  assert.match(rewritten, /^import \{ decodeSave as __decodeSave, assertGameStateSnapshot as __assertSnapshot \} from "\/src\/save\/saveCodec\.ts";/);
  assert.match(rewritten, /const __admitSceneState = function admitSceneState\(input, newGame, codec\)/);
  assert.match(rewritten, /useState\(\(\) => __admitSceneState\(\{"tick":1\}, DEFAULT_GAME_STATE, __codec\)\)/);
  const scripts = readdirSync("scripts").filter(name => /\.(mjs|ts|js)$/.test(name) && name !== "sceneInjection.mjs");
  assert.deepEqual(scripts.filter(name => readFileSync(`scripts/${name}`, "utf8").includes("useState(DEFAULT_GAME_STATE)")), []);
  // Scene producers read saved towns with loadSaveFile / decodeSave, never JSON.parse.
  const producers = scripts.filter(name => /(States|Scenes?)\.tsx?$/.test(name));
  const parsed = producers.filter(name => /JSON\.parse\([^;]*(final-state\.json|\.save\.json|fixtures\/autoplay)/.test(readFileSync(`scripts/${name}`, "utf8")));
  assert.deepEqual(parsed, []);
});

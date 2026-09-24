import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";

const FIXTURE_ROOT = "fixtures/saves";
const TICKS = 1_000;

function fixtureFiles(): string[] {
  const versions = readdirSync(FIXTURE_ROOT).filter(entry => /^v\d+$/.test(entry)).sort();
  const files = versions.flatMap(version => readdirSync(`${FIXTURE_ROOT}/${version}`)
    .filter(file => file.endsWith(".save.json")).map(file => `${FIXTURE_ROOT}/${version}/${file}`));
  const manifest = JSON.parse(readFileSync(`${FIXTURE_ROOT}/v1/manifest.json`, "utf8")) as { readonly v0Fixtures: readonly string[] };
  return [...files, ...manifest.v0Fixtures];
}

test("the fixture set covers every released schema and the big city", () => {
  const files = fixtureFiles();
  assert.ok(files.some(file => file.includes("/v1/")));
  assert.ok(files.some(file => file.includes(`/v${SAVE_SCHEMA_VERSION}/`)));
  assert.ok(files.some(file => file.endsWith("final-state.json")));
  assert.ok(files.every(file => !file.startsWith("output/")), "save fixtures must not depend on the output/ evidence folder");
});

for (const file of fixtureFiles()) {
  test(`save fixture ${file} opens, migrates to schema ${SAVE_SCHEMA_VERSION} and runs ${TICKS} ticks`, () => {
    const { envelope } = decodeSave(new Uint8Array(readFileSync(file)));
    assert.equal(envelope.schemaVersion, SAVE_SCHEMA_VERSION);
    let state: GameState = envelope.state;
    const startTick = state.tick;
    for (let index = 0; index < TICKS; index += 1) state = advanceTick(state);
    const advanced = state.settlement?.outcome === "abandoned" ? state.tick >= startTick : state.tick === startTick + TICKS;
    assert.ok(advanced);
  });
}

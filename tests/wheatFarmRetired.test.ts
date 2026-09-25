import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import { enumerateRuntimeAssets, REPO_ROOT } from "../scripts/provenanceLedgerAssets";
import { decodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";

// C1f gate 2: the 2x2 wheat farm (retired by C1c-2) has no art left in the runtime, and no save migrates to one.
const FARM_ART = /wheat_farm|farm_mixed|farm_pastoral|historical-farm/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

test("Given the runtime manifests When every loadable asset is listed Then none is wheat farm art", () => {
  const runtime = enumerateRuntimeAssets().map(asset => asset.runtimePath);
  assert.ok(runtime.length > 200, "control: the enumeration sees the runtime");
  assert.deepEqual(runtime.filter(path => FARM_ART.test(path)), []);
});

test("Given public/assets and the render sources When they are searched Then no farm art file or image path is left", () => {
  const shipped = files(join(REPO_ROOT, "public/assets")).map(path => relative(REPO_ROOT, path));
  assert.deepEqual(shipped.filter(path => FARM_ART.test(path)), []);
  const world = JSON.parse(readFileSync(join(REPO_ROOT, "public/assets/world_asset_manifest.json"), "utf8")) as { assets: { key: string }[] };
  assert.deepEqual(world.assets.filter(asset => asset.key === "wheat_farm"), []);
  const sources = files(join(REPO_ROOT, "src/render")).filter(path => /\.(ts|tsx)$/.test(path));
  const references = sources.flatMap(path => (readFileSync(path, "utf8").match(/[\w/-]*(?:wheat_farm_\w+|farm_mixed_\w+|historical-farm\/)[\w./-]*/g) ?? [])
    .map(match => `${relative(REPO_ROOT, path)}: ${match}`));
  assert.deepEqual(references, []);
});

test("Given every save fixture When it is migrated to the current schema Then it holds no wheat farm building or site", () => {
  const root = join(REPO_ROOT, "fixtures/saves");
  const saves = readdirSync(root).filter(entry => /^v\d+$/.test(entry)).flatMap(version =>
    readdirSync(join(root, version)).filter(file => file.endsWith(".save.json")).map(file => join(root, version, file)));
  assert.ok(saves.some(path => path.includes("/v9/")), "control: pre-arable saves are included");
  let farmsBefore = 0;
  for (const path of saves) {
    const raw = readFileSync(path, "utf8");
    farmsBefore += (raw.match(/"kind"\s*:\s*"wheat_farm"/g) ?? []).length;
    const { envelope } = decodeSave(new Uint8Array(Buffer.from(raw)));
    assert.equal(envelope.schemaVersion, SAVE_SCHEMA_VERSION);
    const state = envelope.state;
    const farms = [...state.buildings, ...state.constructionSites].filter(item => "kind" in item && item.kind === "wheat_farm");
    assert.deepEqual(farms.map(item => item.id), [], relative(REPO_ROOT, path));
  }
  assert.ok(farmsBefore > 0, "control: some fixtures had wheat farms before migration");
});

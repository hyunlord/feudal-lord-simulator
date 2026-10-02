import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { enumerateRuntimeAssets } from "../scripts/provenanceLedgerAssets";
import { parseCsvRows } from "../scripts/provenanceLedgerCsv";
import { RETIRED_WORLD_ASSET_KEYS } from "../scripts/worldAssetManifest";
import { BUILDING_CATALOG } from "../src/content/buildingCatalog";
import { historicalFacilityManifest } from "../src/render/historicalFacilityManifest";
import { getTerrainPattern } from "../src/render/terrainPatterns";
import { runtimeWorldAssetManifest } from "../src/render/worldAssetManifest.generated";
import { spriteMeta } from "../src/render/worldAssets";

// NAT-4, art audit 2026-10-02. BLD-01: the seven flat legacy facility sprites (public/assets/buildings) only drew while
// a facility painting loaded (and as the site ghost then); ENV-03: the old high-contrast water texture only under the V1
// ground when the water surface had not loaded. Both left the runtime for assets-inbox/retired.

const FACILITIES = ["mill", "quarry", "masonry", "market", "church", "keep"] as const;
const RETIRED = [
  ...[...FACILITIES, "stone_wall_segment"].map(key => ({ key, path: `buildings/${key}.png` })),
  { key: "water", path: "terrain/water.png" },
];

test("the retired keys are out of the runtime manifest and the startup load, their files and rows in the retired store", () => {
  const ledger = new Map(parseCsvRows(readFileSync("docs/provenance/assets.csv", "utf8")).map(row => [row.runtimePath, row]));
  const runtime = new Set(enumerateRuntimeAssets().map(asset => asset.runtimePath));
  for (const { key, path } of RETIRED) {
    assert.ok(RETIRED_WORLD_ASSET_KEYS.includes(key), key);
    assert.ok(runtimeWorldAssetManifest.assets.every(asset => asset.key !== key), `${key}: not in the runtime manifest`);
    assert.equal(spriteMeta(key), null, `${key}: nothing to load or draw`);
    assert.equal(existsSync(`public/assets/${path}`), false, path);
    assert.ok(existsSync(`assets-inbox/retired/${path}`), path);
    assert.ok(!runtime.has(`public/assets/${path}`), path);
    assert.equal(ledger.get(`assets-inbox/retired/${path}`)?.status, "retired", key);
    assert.equal(ledger.has(`public/assets/${path}`), false, key);
  }
});

test("each kind that drew a retired sprite has its own facility painting in the manifest", () => {
  const ids = new Set(historicalFacilityManifest.map(meta => meta.id));
  for (const kind of FACILITIES) {
    const art = BUILDING_CATALOG[kind].facilityArt;
    const named = "id" in art ? [art.id] : [art.quiet, art.active];
    assert.ok(named.every(id => ids.has(id)), `${kind}: ${named.join(", ")}`);
  }
});

test("V1 water's texture is the water surface: none before it loads (the old water.png is not consulted)", () => {
  const created: string[] = [];
  const context = { createPattern: (image: unknown) => { created.push(String(image)); return null; } } as unknown as CanvasRenderingContext2D;
  assert.equal(getTerrainPattern(context, "water"), null);
  assert.deepEqual(created, [], "Node has no water surface yet, so no pattern is made");
});

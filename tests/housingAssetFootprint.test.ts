import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

import { BUILDING_SPECS } from "../scripts/worldAssetContracts";
import { parseWorldAssetManifest } from "../scripts/worldAssetManifest";
import { BUILDING_SPRITE_CONTRACTS, STONE_TOWN_BUILDING_SPRITE_CONTRACTS } from "../scripts/worldSpritePipeline";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { spriteMeta } from "../src/render/worldAssets";

const houseKeys = ["house_l0", "house_l1", "house_l2", "house_l3", "house_l4"] as const;
const { width, height } = BUILDING_CONFIG_BY_KIND.house;
const logicalFootprint = { width, height };

it("Given every house level When asset contracts are compared with occupied tiles Then growth preserves the logical footprint", () => {
  for (const key of houseKeys) {
    assert.deepEqual(BUILDING_SPECS[key].footprint, logicalFootprint, key);
  }
});

it("Given generated house sprites When normalization contracts load Then each level uses single-tile source proportions", () => {
  const contracts = { ...BUILDING_SPRITE_CONTRACTS, ...STONE_TOWN_BUILDING_SPRITE_CONTRACTS };

  for (const key of ["house_l1", "house_l2", "house_l3", "house_l4"] as const) {
    assert.equal(contracts[key].footprint, logicalFootprint.width, key);
  }
});

it("Given released house assets When public and runtime metadata load Then every level anchors to its occupied tile", () => {
  const publicManifest: unknown = JSON.parse(readFileSync("public/assets/world_asset_manifest.json", "utf8"));
  const released = parseWorldAssetManifest(publicManifest);

  for (const key of houseKeys) {
    const publicAsset = released.assets.find((asset) => asset.key === key);
    const runtimeAsset = spriteMeta(key);
    assert.ok(publicAsset, `${key}: public asset missing`);
    assert.ok(runtimeAsset, `${key}: runtime asset missing`);
    assert.deepEqual(publicAsset.footprint, logicalFootprint, `${key}: public footprint`);
    assert.deepEqual(runtimeAsset.footprint, logicalFootprint, `${key}: runtime footprint`);
  }
});

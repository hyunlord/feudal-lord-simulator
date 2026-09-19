import assert from "node:assert/strict";
import test from "node:test";
import { farmAssetStatuses } from "../src/render/farmAssets";
import { stoneWallAssetStatuses } from "../src/render/stoneWallAssets";
import { assetUrlForBase } from "../src/render/worldAssets";

test("historical sprites remain same-origin under root and nested deployment paths", () => {
  for (const asset of [...farmAssetStatuses(), ...stoneWallAssetStatuses()]) {
    const root = new URL(asset.url, "http://localhost:3218");
    assert.equal(root.origin, "http://localhost:3218");
    assert.match(root.pathname, /^\/assets\/buildings\/historical-/);
    const nested = assetUrlForBase(asset.url.replace(/^\//, ""), "/feudal/");
    assert.match(nested, /^\/feudal\/assets\/buildings\/historical-/);
  }
});

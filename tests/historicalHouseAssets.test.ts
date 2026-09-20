import { authoredAssetPath } from "../scripts/runtimeAssetProvenance";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { historicalHouseAssetManifest } from "../src/render/historicalHouseAssetManifest.generated";
import { historicalHouseAssetMeta, historicalHouseSpriteRect } from "../src/render/historicalHouseAssets";
import { houseCompoundAssetManifest } from "../src/render/houseCompoundAssetManifest.generated";
import { tileToScreen } from "../src/render/iso";

test("historical house authored registrations retain original-size provenance and bounded crops", () => {
  for (const meta of [...historicalHouseAssetManifest, ...houseCompoundAssetManifest]) {
    const png = readFileSync(authoredAssetPath(meta.url));
    assert.equal(png.readUInt32BE(16), meta.width);
    assert.equal(png.readUInt32BE(20), meta.height);
    assert.ok(meta.alphaBounds.x + meta.alphaBounds.width <= meta.width);
    assert.ok(meta.alphaBounds.y + meta.alphaBounds.height <= meta.height);
  }
  assert.ok(historicalHouseAssetMeta(3)?.url.endsWith("house_l3-v2.png"));
  assert.equal(historicalHouseAssetMeta(5), null);
});

test("all single-house stages retain the same tile contact while preserving image aspect", () => {
  for (const tx of [0, 42, 95]) for (const ty of [0, 25, 95]) {
    const building = { id: 1, kind: "house" as const, tx, ty };
    const center = tileToScreen(tx, ty);
    for (const meta of historicalHouseAssetManifest) {
      const rect = historicalHouseSpriteRect(building, meta);
      assert.ok(Math.abs(rect.y + rect.height - (center.sy + 16)) < 1e-8);
      assert.equal(rect.x + rect.width / 2, center.sx);
      assert.ok(Math.abs(rect.height / rect.width - meta.alphaBounds.height / meta.alphaBounds.width) < 1e-8);
    }
  }
});

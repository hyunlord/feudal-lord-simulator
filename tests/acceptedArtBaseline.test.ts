import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { parseArchivedAssetHashes } from "../scripts/acceptedArtVerification";
import { WORLD_ASSET_KEYS } from "../scripts/worldAssetContracts";

const archived = (): unknown => JSON.parse(readFileSync("docs/asset-evidence/accepted-art/before/world_asset_manifest.json", "utf8"));
const entries = WORLD_ASSET_KEYS.map(key => ({ key, sha256: "a".repeat(64) }));

it("reads original asset hashes without imposing current geometry on an archived manifest", () => {
  const hashes = parseArchivedAssetHashes(archived());
  assert.equal(hashes.size, WORLD_ASSET_KEYS.length);
  assert.match(hashes.get("house_l3") ?? "", /^[a-f0-9]{64}$/);
});

it("rejects incomplete, duplicate, unknown or malformed archived fingerprints", () => {
  for (const input of [null, {}, { assets: entries.slice(1) }, { assets: [...entries, entries[0]] },
    { assets: entries.map((entry, i) => i === 0 ? { ...entry, key: "unknown" } : entry) },
    { assets: entries.map((entry, i) => i === 0 ? { ...entry, sha256: "bad" } : entry) }]) {
    assert.throws(() => parseArchivedAssetHashes(input));
  }
});

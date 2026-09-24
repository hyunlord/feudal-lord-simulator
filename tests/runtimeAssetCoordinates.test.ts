import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { registerRuntimeAsset, runtimeAssetCrop } from "../src/render/runtimeAssetCoordinates";
import { runtimeAssetDerivatives } from "../src/render/runtimeAssetDerivatives.generated";

const imageAt = (width: number, height: number) => ({ naturalWidth: width, naturalHeight: height }) as HTMLImageElement;
const crop = { x: 123, y: 231, width: 321, height: 456 };

test("authored coordinates and original-size fallback remain unchanged", () => {
  const image = imageAt(1254, 1254);
  assert.equal(registerRuntimeAsset(image, "/assets/missing.png", 1254, 1254), true);
  assert.equal(runtimeAssetCrop(image, crop), crop);
  assert.equal(registerRuntimeAsset(imageAt(10, 10), "/assets/missing.png", 1254, 1254), false);
});

test("derived crops preserve registration under base URLs and reject mismatched originals", () => {
  for (const meta of runtimeAssetDerivatives) {
    const image = imageAt(meta.width, meta.height);
    assert.equal(registerRuntimeAsset(image, `/game/${meta.url}`, meta.originalWidth, meta.originalHeight), true);
    const actual = runtimeAssetCrop(image, crop);
    assert.deepEqual(actual, { x: crop.x * (meta.width / meta.originalWidth),
      y: crop.y * (meta.height / meta.originalHeight),
      width: crop.width * (meta.width / meta.originalWidth), height: crop.height * (meta.height / meta.originalHeight) });
    assert.equal(registerRuntimeAsset(imageAt(meta.width, meta.height), meta.url, meta.originalWidth + 1, meta.originalHeight), false);
  }
});

test("every runtime derivative matches its SHA and dimensions even without the source archive", () => {
  for (const meta of runtimeAssetDerivatives) {
    const runtime = readFileSync(`public/${meta.url}`);
    assert.equal(runtime.readUInt32BE(16), meta.width);
    assert.equal(runtime.readUInt32BE(20), meta.height);
    assert.equal(createHash("sha256").update(runtime).digest("hex"), meta.sha256);
  }
});

test("available immutable originals match their own SHA and dimensions", async (context) => {
  for (const meta of runtimeAssetDerivatives) {
    const source = `docs/asset-evidence/runtime-sources/${meta.url.slice("assets/".length)}`;
    await context.test(meta.url, { skip: existsSync(source) ? false : `Optional original unavailable: ${source}; runtime derivative verified separately` }, () => {
      const original = readFileSync(source);
      assert.equal(original.readUInt32BE(16), meta.originalWidth);
      assert.equal(original.readUInt32BE(20), meta.originalHeight);
      assert.equal(createHash("sha256").update(original).digest("hex"), meta.originalSha256);
    });
  }
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";

import {
  getSprite,
  parseWorldAssetManifest,
  preloadWorldAssets,
  spriteMeta,
  type LoadStatus,
} from "../src/render/worldAssets";
import { WORLD_ASSET_KEYS } from "../scripts/worldAssetContracts";

const runAssetScenario = (
  mode: "load" | "error" | "constructor_throw" | "src_throw",
): Readonly<Record<string, unknown>> => {
  const script = `
const created = [];
class FakeImage {
  onload = null;
  onerror = null;
  complete = false;
  naturalWidth = 0;
  #src = "";
  constructor() {
    if (${JSON.stringify(mode)} === "constructor_throw") throw new TypeError("constructor failed");
  }
  get src() { return this.#src; }
  set src(value) {
    if (${JSON.stringify(mode)} === "src_throw") throw new TypeError("src failed");
    this.#src = value;
    created.push(this);
    queueMicrotask(() => {
      if (${JSON.stringify(mode)} === "load") {
        this.complete = true;
        this.naturalWidth = 1;
        this.onload?.(new Event("load"));
        return;
      }
      this.onerror?.(new Event("error"));
    });
  }
}
Object.defineProperty(globalThis, "Image", { configurable: true, value: FakeImage });
const assets = await import("./src/render/worldAssets.ts");
const first = assets.preloadWorldAssets();
const second = assets.preloadWorldAssets();
const loadingStatus = assets.spriteMeta("house_l1")?.status;
await Promise.all([first, second]);
await assets.preloadWorldAssets();
const houseMeta = assets.spriteMeta("house_l1");
const grassMeta = assets.spriteMeta("grass");
const missingMeta = assets.spriteMeta("missing_key");
console.log(JSON.stringify({
  shared: first === second,
  created: created.length,
  loadingStatus,
  spriteReady: assets.getSprite("house_l1") !== null,
  unknownSprite: assets.getSprite("missing_key") === null,
  houseStatus: houseMeta?.status,
  grassStatus: grassMeta?.status,
  houseUrl: houseMeta?.url,
  missingMeta,
}));
`;
  return JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--eval", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  }));
};

describe("browser world asset registry", () => {
  it("Given an unsupported category When the manifest crosses the runtime boundary Then parsing rejects it", () => {
    const invalid = {
      assets: [assetFixture({ category: "character" })],
    };

    assert.throws(() => parseWorldAssetManifest(invalid), /category/);
  });

  it("Given an unsafe asset path When the manifest crosses the runtime boundary Then parsing rejects it", () => {
    const invalid = {
      assets: [assetFixture({ path: "../../private/house.png" })],
    };

    assert.throws(() => parseWorldAssetManifest(invalid), /path/);
  });

  it("Given non-positive image dimensions When the manifest crosses the runtime boundary Then parsing rejects it", () => {
    const invalid = {
      assets: [assetFixture({ width: 0 })],
    };

    assert.throws(() => parseWorldAssetManifest(invalid), /width/);
  });

  it("Given the release manifest When metadata is queried before preload Then exact contracts are idle", () => {
    const status: LoadStatus = "idle";

    const meta = spriteMeta("house_l3");

    assert.equal(status, "idle");
    assert.deepEqual(meta, {
      key: "house_l3",
      category: "building",
      url: "/assets/buildings/house_l3.png",
      width: 160,
      height: 192,
      anchor: { x: 80, y: 176 },
      footprint: { width: 2, height: 2 },
      status: "idle",
    });
    assert.equal(spriteMeta("missing_key"), null);
    assert.equal(getSprite("missing_key"), null);
    assert.equal(typeof preloadWorldAssets, "function");
  });

  it("Given concurrent callers When images load Then every asset loads once and remains cached", () => {
    const result = runAssetScenario("load");

    assert.equal(result["shared"], true);
    assert.equal(result["created"], WORLD_ASSET_KEYS.length);
    assert.equal(result["loadingStatus"], "loading");
    assert.equal(result["spriteReady"], true);
    assert.equal(result["unknownSprite"], true);
    assert.equal(result["houseStatus"], "ready");
    assert.equal(result["houseUrl"], "/assets/buildings/house_l1.png");
    assert.equal(result["missingMeta"], null);
  });

  it("Given browser image errors When preload runs Then it resolves and marks assets missing", () => {
    const result = runAssetScenario("error");

    assert.equal(result["shared"], true);
    assert.equal(result["created"], WORLD_ASSET_KEYS.length);
    assert.equal(result["spriteReady"], false);
    assert.equal(result["unknownSprite"], true);
    assert.equal(result["houseStatus"], "missing");
  });

  it("Given Image construction throws When preload runs Then it resolves and marks assets missing", () => {
    const result = runAssetScenario("constructor_throw");

    assert.equal(result["shared"], true);
    assert.equal(result["created"], 0);
    assert.equal(result["spriteReady"], false);
    assert.equal(result["houseStatus"], "missing");
    assert.equal(result["grassStatus"], "missing");
  });

  it("Given assigning Image src throws When preload runs Then it resolves and marks assets missing", () => {
    const result = runAssetScenario("src_throw");

    assert.equal(result["shared"], true);
    assert.equal(result["created"], 0);
    assert.equal(result["spriteReady"], false);
    assert.equal(result["houseStatus"], "missing");
    assert.equal(result["grassStatus"], "missing");
  });
});

function assetFixture(overrides: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  return {
    key: "house_l0",
    category: "building",
    path: "public/assets/buildings/house_l0.png",
    width: 96,
    height: 112,
    anchor: { x: 48, y: 96 },
    footprint: { width: 1, height: 1 },
    ...overrides,
  };
}

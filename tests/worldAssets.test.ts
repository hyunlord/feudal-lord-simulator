import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { runtimeWorldAssetManifest } from "../src/render/worldAssetManifest.generated";
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
const canvasEvents = [];
class FakeCanvas {
  width = 0;
  height = 0;
  context = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    drawImage: (image, dx, dy, width, height) => {
      canvasEvents.push({
        imageKind: image.constructor.name,
        smoothing: this.context.imageSmoothingEnabled,
        quality: this.context.imageSmoothingQuality,
        dx,
        dy,
        width,
        height,
      });
    },
  };
  getContext(kind) {
    if (kind !== "2d") return null;
    return this.context;
  }
}
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
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: { createElement: () => new FakeCanvas() },
});
const assets = await import("./src/render/worldAssets.ts");
const first = assets.preloadWorldAssets();
const second = assets.preloadWorldAssets();
const loadingStatus = assets.spriteMeta("house_l1")?.status;
await Promise.all([first, second]);
await assets.preloadWorldAssets();
const houseMeta = assets.spriteMeta("house_l1");
const grassMeta = assets.spriteMeta("grass");
const missingMeta = assets.spriteMeta("missing_key");
const houseSprite = assets.getSprite("house_l1");
console.log(JSON.stringify({
  shared: first === second,
  created: created.length,
  canvasEvents,
  houseSpriteKind: houseSprite?.constructor.name,
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
  it("Given the generated runtime manifest When compared with the public release manifest Then runtime asset coverage is exact", () => {
    const publicManifest = JSON.parse(readFileSync("public/assets/world_asset_manifest.json", "utf8")) as {
      readonly assets: readonly Readonly<Record<string, unknown>>[];
    };
    const runtimeProjection = publicManifest.assets.map((asset) => ({
      key: asset["key"],
      category: asset["category"],
      path: asset["path"],
      width: asset["width"],
      height: asset["height"],
      anchor: asset["anchor"],
      footprint: asset["footprint"],
      renderScale: asset["renderScale"],
    }));

    assert.deepEqual(runtimeWorldAssetManifest.assets, runtimeProjection);
  });

  it("Given the release manifest When render scales are read Then every asset has a finite positive scale", () => {
    const publicManifest = JSON.parse(readFileSync("public/assets/world_asset_manifest.json", "utf8")) as {
      readonly assets: readonly Readonly<Record<string, unknown>>[];
    };

    const invalid = publicManifest.assets
      .filter((asset) => typeof asset["renderScale"] !== "number" || !Number.isFinite(asset["renderScale"]) || asset["renderScale"] <= 0)
      .map((asset) => asset["key"]);

    assert.deepEqual(invalid, []);
  });

  it("Given target sprite categories When render scales are read Then effective heights match the target bands", () => {
    const publicManifest = JSON.parse(readFileSync("public/assets/world_asset_manifest.json", "utf8")) as {
      readonly assets: readonly Readonly<Record<string, unknown>>[];
    };
    const targetEntries = [
      ...["house_l0", "house_l1", "well"].map((key) => ({ key, assetKey: key, targetRatio: 1.8 })),
      ...["mill", "sawmill", "logging_camp", "masonry", "quarry", "wheat_farm"].map((key) => ({ key, assetKey: key, targetRatio: 2.2 })),
      ...["house_l2", "house_l3", "house_l4"].map((key) => ({ key, assetKey: key, targetRatio: 2.6 })),
      ...["barn", "storehouse", "market"].map((key) => ({ key, assetKey: key, targetRatio: 2.2 })),
      { key: "granary", assetKey: "barn", targetRatio: 2.2 },
      ...["church", "keep"].map((key) => ({ key, assetKey: key, targetRatio: 3.2 })),
      ...["tree_oak_large", "tree_oak_small", "tree_pine_tall", "tree_pine_short", "tree_birch", "tree_dead"].map((key) => ({ key, assetKey: key, targetRatio: 2.0 })),
    ];
    const failures = targetEntries.flatMap(({ key, assetKey, targetRatio }) => {
      const asset = publicManifest.assets.find((candidate) => candidate["key"] === assetKey);
      if (asset === undefined) return [`${key}:missing`];
      const height = asset["height"];
      const renderScale = asset["renderScale"];
      if (typeof height !== "number" || typeof renderScale !== "number") return [`${key}:missing`];
      const effectiveHeight = height * renderScale;
      return Math.abs(effectiveHeight - targetRatio * 32) <= 0.000001 ? [] : [`${key}:${effectiveHeight}`];
    });

    assert.deepEqual(failures, []);
  });

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

  it("Given missing or invalid render scales When the manifest crosses the runtime boundary Then parsing rejects them", () => {
    assert.throws(() => parseWorldAssetManifest({ assets: [assetFixture({ renderScale: undefined })] }), /renderScale/);
    assert.throws(() => parseWorldAssetManifest({ assets: [assetFixture({ renderScale: 0 })] }), /renderScale/);
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
      renderScale: 0.43333333333333335,
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
    assert.equal(result["houseSpriteKind"], "FakeCanvas");
    assert.equal(Array.isArray(result["canvasEvents"]), true);
    const canvasEvents = result["canvasEvents"];
    if (!Array.isArray(canvasEvents)) throw new Error("canvasEvents must be an array");
    assert.equal(canvasEvents.length, 23);
    assert.deepEqual(
      canvasEvents.filter((event) =>
        isRecord(event) && event["width"] === 46 && event["height"] === 58
      ),
      [{
        imageKind: "FakeImage",
        smoothing: true,
        quality: "high",
        dx: 0,
        dy: 0,
        width: 46,
        height: 58,
      }],
    );
    assert.equal(
      canvasEvents.every((event) =>
        isRecord(event) && event["imageKind"] === "FakeImage" && event["smoothing"] === true && event["quality"] === "high"
      ),
      true,
    );
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
    renderScale: 1,
    anchor: { x: 48, y: 96 },
    footprint: { width: 1, height: 1 },
    ...overrides,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

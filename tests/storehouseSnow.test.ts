/**
 * NAT-5 RUN-02 (decision N4-D3): the storehouse roof snow (scripts/installStorehouseSnow.py, src/render/storehouseSnowArt.ts).
 * Three confirmed layers installed byte for byte with provenance and installed_by NAT-5; each lies on its body's own
 * canvas (no snow pixel off the body at offset (0, 0)); in winter a storehouse draws the layer of the body it shows
 * (base -> a, Wave 2 b -> b, c -> c) into the body's fitted rect, and none in summer.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decodePng } from "../scripts/keyartDerivatives";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { drawBuildingOverlays } from "../src/render/buildingOverlays";
import { fittedBuildingSpriteRect } from "../src/render/buildingSpriteFit";
import { preloadBuildingVariantAssets } from "../src/render/buildingVariantAssets";
import { beginBuildingVariantFrame, buildingVariantAssignments, setBuildingVariantsEnabled } from "../src/render/buildingVariants";
import { resetSeasonBlendForTest } from "../src/render/seasonTransition";
import { STOREHOUSE_SNOW_IMAGES } from "../src/render/storehouseSnowManifest.generated";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const lines = (path: string) => readFileSync(path, "utf8").split(/\r?\n/);
const BATCH = "storehouse-corner/candidates-20261003/assets";

test("three confirmed snow layers installed byte for byte, with provenance and installed_by NAT-5; no gate corner", () => {
  const ledger = lines("docs/provenance/assets.csv");
  const inbox = lines("assets-inbox/INBOX_LEDGER.csv");
  for (const [key, meta] of Object.entries(STOREHOUSE_SNOW_IMAGES)) {
    const source = `assets-inbox/${BATCH}/storehouse_${key}_snow-v1.png`;
    assert.equal(sha(`public/${meta.url}`), sha(source), key);
    assert.ok(ledger.some(line => line.includes(`,public/${meta.url},${sha(source)},${source},`)), `${key} provenance`);
    const entry = inbox.find(line => line.startsWith(`storehouse-corner,${BATCH}/storehouse_${key}_snow-v1.png,`));
    assert.ok(entry !== undefined && entry.includes(",confirmed,") && entry.endsWith(",NAT-5"), `${key} inbox ledger`);
  }
  for (const line of inbox.filter(row => row.startsWith(`storehouse-corner,${BATCH}/gate_corner_`))) assert.equal(line.endsWith(",NAT-5"), false, line);
});

test("each layer lies on its body's roof: same canvas, no snow pixel where the body is clear", () => {
  for (const [key, meta] of Object.entries(STOREHOUSE_SNOW_IMAGES)) {
    const snow = decodePng(readFileSync(`public/${meta.url}`)); const body = decodePng(readFileSync(`public/${meta.body}`));
    assert.deepEqual([snow.width, snow.height, body.width, body.height], [160, 136, 160, 136], key);
    let off = 0; let on = 0;
    for (let index = 3; index < snow.data.length; index += 4) {
      if (snow.data[index]! <= 8) continue;
      on += 1;
      if (body.data[index]! < 128) off += 1;
    }
    assert.equal(off, 0, `${key}: ${off} of ${on} snow pixels off the body`);
    assert.ok(on > 2_500, `${key}: a roof's worth of snow (${on} px)`);
  }
});

class LoadedImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 160;
  naturalHeight = 136;
  url = "";
  set src(value: string) { this.url = value.replace(/^\/+/, ""); queueMicrotask(() => this.onload?.()); }
}
type Draw = { readonly url: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number };
function recorder() {
  const drawn: Draw[] = [];
  const values: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const context = new Proxy({}, {
    get: (_target, key) => key === "drawImage" ? (image: { url?: string }, ...args: number[]) => {
      const [x, y, width, height] = args.length >= 8 ? args.slice(4) : args;
      drawn.push({ url: image.url ?? "raster", x: x!, y: y!, width: width!, height: height! });
    }
      : key === "getTransform" ? () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      : key in values ? values[key] : () => undefined,
    set: (_target, key, value) => { values[key] = value; return true; },
  }) as CanvasRenderingContext2D;
  return { context, drawn };
}
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const storehouse = (index: number): Building =>
  ({ id: `storehouse-test-${index}`, kind: "storehouse", tx: 6 + (index % 8) * 3, ty: 6 + Math.floor(index / 8) * 3, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 }) as Building;

test("in winter a storehouse draws its body's snow layer in the body's fitted rect; none in summer; base with variants off", async () => {
  (globalThis as unknown as { Image: unknown }).Image = LoadedImage;
  await preloadBuildingVariantAssets();
  const stores = Array.from({ length: 24 }, (_, index) => storehouse(index));
  const year = 12 * 4_000;
  const winter: GameState = { ...DEFAULT_GAME_STATE, tick: year + 3_500, buildings: stores };
  const summer: GameState = { ...winter, tick: year + 1_500 };
  const chosen = buildingVariantAssignments(winter);
  beginBuildingVariantFrame(winter);
  resetSeasonBlendForTest();
  for (const building of stores) drawBuildingOverlays(recorder().context, winter, building); // the layers' first request
  await flush();
  const round = (draw: { x: number; y: number; width: number; height: number }) => [draw.x, draw.y, draw.width, draw.height].map(value => Math.round(value * 100) / 100);
  const seen = new Set<string>();
  try {
    for (const building of stores) {
      const variant = chosen.get(building.id)?.variant.id ?? "base";
      const expected = variant === "base" ? "a" : variant;
      seen.add(expected);
      const drawn = recorder();
      drawBuildingOverlays(drawn.context, winter, building);
      const snow = drawn.drawn.filter(draw => draw.url.includes("storehouse-snow"));
      assert.deepEqual(snow.map(draw => draw.url), [STOREHOUSE_SNOW_IMAGES[expected as "a" | "b" | "c"].url], `${building.id} (${variant})`);
      assert.deepEqual(round(snow[0]!), round(fittedBuildingSpriteRect("storehouse", building)), "the body's fitted rect");
      const warm = recorder();
      drawBuildingOverlays(warm.context, summer, building);
      assert.equal(warm.drawn.some(draw => draw.url.includes("storehouse-snow")), false, "no snow in summer");
    }
    assert.deepEqual([...seen].sort(), ["a", "b", "c"], "the three bodies all occur");
    setBuildingVariantsEnabled(false);
    const bare = recorder();
    drawBuildingOverlays(bare.context, winter, stores[0]!);
    assert.deepEqual(bare.drawn.filter(draw => draw.url.includes("storehouse-snow")).map(draw => draw.url), [STOREHOUSE_SNOW_IMAGES.a.url]);
  } finally {
    setBuildingVariantsEnabled(true);
    resetSeasonBlendForTest();
  }
});

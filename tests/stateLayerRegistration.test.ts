import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decodePng } from "../scripts/keyartDerivatives";
import { parseCsv } from "../scripts/provenanceLedgerCsv";
import { historicalHouseAssetManifest } from "../src/render/historicalHouseAssetManifest.generated";
import { houseCompoundAssetManifest } from "../src/render/houseCompoundAssetManifest.generated";
import type { HousePainting } from "../src/render/houseVariantChoice";
import { drawWave26House, drawWave26HouseLayers, preloadWave26HouseLayers, preloadWave26HousePaintings, wave26HouseRect } from "../src/render/wave26HouseArt";
import { WAVE26_HOUSE_IMAGES, WAVE26_HOUSE_VARIANTS } from "../src/render/wave26HouseManifest.generated";
import { WAVE30_PAIR_HOUSE_IMAGES, WAVE30_PAIR_HOUSE_VARIANTS } from "../src/render/wave30PairHouseManifest.generated";
import { WAVE32_GRANARY_IMAGES } from "../src/render/wave32GranaryManifest.generated";

// BLD-06 (art audit 2026-10-02): a state layer is drawn with its painting's one transform (the painting's crop into the
// painting's rect) for every state, and the repainted layers that were cut a little off their painting are registered
// onto it offline (scripts/registerStateLayers.py, docs/provenance/state-layer-registration.csv).

const IMAGES = { ...WAVE26_HOUSE_IMAGES, ...WAVE30_PAIR_HOUSE_IMAGES };
const STATES = ["weathered", "fresh", "boarded", "snow"] as const;

class LoadedImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  url = "";
  set src(value: string) {
    this.url = value.replace(/^\/+/, "");
    const image = Object.values(IMAGES).find(entry => entry.url === this.url);
    this.naturalWidth = image?.width ?? 153;
    this.naturalHeight = image?.height ?? 153;
    queueMicrotask(() => this.onload?.());
  }
}

type Draw = { readonly url: string; readonly rect: readonly number[] };
function recorder() {
  const drawn: Draw[] = [];
  const values: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const context = new Proxy({}, {
    get: (_target, key) => key === "drawImage" ? (image: { url?: string }, ...args: number[]) => {
      const rect = args.length >= 8 ? args.slice(4) : args;
      drawn.push({ url: image.url ?? "raster", rect: rect.map(value => Math.round(value * 1000) / 1000) });
    }
      : key === "getTransform" ? () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      : key in values ? values[key] : () => undefined,
    set: (_target, key, value) => { values[key] = value; return true; },
  }) as CanvasRenderingContext2D;
  return { context, drawn };
}

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const [recordHeader, ...recordRows] = parseCsv(readFileSync("docs/provenance/state-layer-registration.csv", "utf8"));
const records = recordRows.map(row => Object.fromEntries(recordHeader!.map((name, index) => [name, row[index]!])));

function approvedBounds(variant: HousePainting) {
  const meta = "lot" in variant
    ? houseCompoundAssetManifest.find(entry => entry.level === variant.level && entry.axis === variant.lot)!
    : historicalHouseAssetManifest.find(entry => entry.level === variant.level)!;
  return meta.alphaBounds;
}

test("every state layer of every Wave 26 / 30 painting draws into the painting's own rect", async () => {
  (globalThis as unknown as { Image: unknown }).Image = LoadedImage;
  await preloadWave26HousePaintings();
  preloadWave26HouseLayers();
  await flush();
  const rect = { x: 12.5, y: -40.25, width: 56.32, height: 61.5 };
  const variants: readonly HousePainting[] = [...WAVE26_HOUSE_VARIANTS, ...WAVE30_PAIR_HOUSE_VARIANTS];
  assert.equal(variants.length, 38);
  for (const variant of variants) {
    const bounds = approvedBounds(variant);
    const body = recorder();
    assert.equal(drawWave26House(body.context, variant, bounds, rect), true, variant.key);
    assert.equal(body.drawn.length, 1, variant.key);
    const target = wave26HouseRect(variant, bounds, rect);
    assert.deepEqual(body.drawn[0]!.rect, [target.x, target.y, target.width, target.height].map(value => Math.round(value * 1000) / 1000));
    for (const state of STATES) {
      const layer = recorder();
      drawWave26HouseLayers(layer.context, variant, bounds, rect, {
        state: state === "fresh" || state === "weathered" ? state : null, boarded: state === "boarded", snow: state === "snow" });
      assert.deepEqual(layer.drawn.map(draw => draw.url), [IMAGES[`${variant.key}_${state}` as keyof typeof IMAGES].url], `${variant.key} ${state}`);
      assert.deepEqual(layer.drawn[0]!.rect, body.drawn[0]!.rect, `${variant.key} ${state}: the painting's rect`);
    }
  }
});

test("registration record: every Wave 26 / 30 / 32 state layer measured or additive, bytes as recorded, transforms bounded", () => {
  const layers = [...Object.values(IMAGES), ...Object.values(WAVE32_GRANARY_IMAGES)]
    .map(image => `public/${image.url}`).filter(path => /_(weathered|fresh|boarded|snow|empty|half|full)\.png$/.test(path));
  assert.deepEqual(records.map(row => row.runtimePath).sort(), layers.sort());
  const registered = records.filter(row => row.decision === "registered");
  assert.ok(registered.length > 0 && registered.length <= 40, `${registered.length} registered`);
  for (const row of records) {
    assert.equal(sha(row.runtimePath!), row.runtimeSha256, row.runtimePath);
    if (row.decision === "additive (not measured)") assert.match(row.state!, /^(snow|empty|half|full)$/, row.runtimePath);
    else assert.match(row.state!, /^(weathered|fresh|boarded)$/, row.runtimePath);
    if (row.decision !== "registered") { assert.equal(row.runtimeSha256, row.sourceSha256, `${row.runtimePath}: the received bytes`); continue; }
    assert.notEqual(row.runtimeSha256, row.sourceSha256, row.runtimePath);
    assert.ok(Number(row.best) - Number(row.identity) >= 0.08, row.runtimePath);
    assert.ok(Math.abs(Number(row.dx)) <= 7 && Math.abs(Number(row.dy)) <= 7 && Math.abs(Number(row.scale) - 1) <= 0.08, row.runtimePath);
  }
});

test("a registered layer stays inside its painting's silhouette and covers it (the state picture moved, not a fragment)", () => {
  for (const row of records.filter(entry => entry.decision === "registered")) {
    const layer = decodePng(new Uint8Array(readFileSync(row.runtimePath!)));
    const body = decodePng(new Uint8Array(readFileSync(row.runtimePath!.replace(/_(weathered|fresh|boarded)\.png$/, ".png"))));
    assert.deepEqual([layer.width, layer.height], [body.width, body.height], row.runtimePath);
    let outside = 0; let covered = 0; let painted = 0;
    for (let index = 3; index < layer.data.length; index += 4) {
      if (body.data[index]! > 128) painted += 1;
      if (layer.data[index]! === 0) continue;
      if (body.data[index]! === 0) outside += 1;
      else if (layer.data[index]! > 128) covered += 1;
    }
    assert.equal(outside, 0, `${row.runtimePath}: nothing outside the painting`);
    assert.ok(covered >= painted * 0.9, `${row.runtimePath}: ${covered} of ${painted}`);
  }
});

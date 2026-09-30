import assert from "node:assert/strict";
import test from "node:test";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import type { House } from "../src/population/population.types";
import { drawBuildingOverlays } from "../src/render/buildingOverlays";
import { houseCompoundAssetManifest } from "../src/render/houseCompoundAssetManifest.generated";
import { drawHouseCompoundSprite, preloadHouseCompoundAssets } from "../src/render/houseCompoundAssets";
import { drawHouseCondition } from "../src/render/houseConditionOverlay";
import { rawHouseBody } from "../src/render/houseVariantChoice";
import { ROOF_SMOKE_ANCHORS } from "../src/render/roofSmokeAnchors.generated";
import { beginHouseVariantFrame, preloadWave26HouseLayers, preloadWave26HousePaintings, shownHouseVariantUrl } from "../src/render/wave26HouseArt";
import { WAVE30_PAIR_HOUSE_IMAGES } from "../src/render/wave30PairHouseManifest.generated";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

// INSTALL-30 on the canvas: a pair household's Wave 30 painting replaces the approved pair, its own layers (weathered /
// fresh, boarded, snow) go on it, the approved pair's wear marks stay off it and its roof smoke follows it; no seed
// gives a pair the approved painting (bare: it has no layers).

class LoadedImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  url = "";
  set src(value: string) {
    this.url = value.replace(/^\/+/, "");
    const approved = houseCompoundAssetManifest.find(meta => meta.url === this.url);
    const wave30 = Object.values(WAVE30_PAIR_HOUSE_IMAGES).find(image => image.url === this.url);
    // The approved pairs load at their declared size; everything else at its manifest size.
    this.naturalWidth = approved?.width ?? wave30?.width ?? 184;
    this.naturalHeight = approved?.height ?? wave30?.height ?? 184;
    queueMicrotask(() => this.onload?.());
  }
}

function recorder() {
  const drawn: string[] = [];
  const values: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const context = new Proxy({}, {
    get: (_target, key) => key === "drawImage" ? (image: { url?: string }) => { drawn.push(image.url ?? "raster"); }
      : key === "getTransform" ? () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      : key in values ? values[key] : () => undefined,
    set: (_target, key, value) => { values[key] = value; return true; },
  }) as CanvasRenderingContext2D;
  return { context, drawn };
}

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const record = (tick: number, template: string, buildingId: string): HistoryRecord =>
  ({ id: `h-${tick}-${template}`, tick, kind: "person", template, subject: { type: "household", id: buildingId }, severity: 0, place: { tx: 0, ty: 0, buildingId } });

test("a pair household's Wave 30 painting with its own layers and smoke; no approved wear marks; the approved pick unchanged", async () => {
  (globalThis as unknown as { Image: unknown }).Image = LoadedImage;
  await preloadHouseCompoundAssets();
  await preloadWave26HousePaintings();
  preloadWave26HouseLayers();
  await flush();
  const single = DEFAULT_GAME_STATE.buildings.find(building => building.kind === "house" && building.houseLot === undefined)!;
  const home: Building = { ...single, houseLot: "vertical" };
  const seed = [...Array(500).keys()].find(candidate => rawHouseBody(candidate, home.id, 3, "common", "vertical").variant !== null)!;
  const variant = rawHouseBody(seed, home.id, 3, "common", "vertical").variant!;
  const url = `assets/wave30/house_pair/${variant.key}.png`;
  const lived: House = { ...DEFAULT_GAME_STATE.houses.find(house => house.buildingId === home.id)!, level: 3, builtLevel: 3, residents: 4 };
  const { persons: _persons, history: _history, ...town } = DEFAULT_GAME_STATE;
  const buildings = DEFAULT_GAME_STATE.buildings.map(building => building.id === home.id ? home : building);
  const houses = (fields: Partial<House>) => [{ ...lived, ...fields }, ...DEFAULT_GAME_STATE.houses.filter(house => house.buildingId !== home.id)];
  // Winter (season 3) of year 12: an old founding household, weathered; abandoned: boarded.
  const winter: GameState = { ...town, seed, buildings, tick: 12 * 4_000 + 3_500, houses: houses({ abandonedTick: 40_000 }) };
  beginHouseVariantFrame(winter);
  const body = recorder();
  assert.equal(drawHouseCompoundSprite(body.context, home, 3), true);
  assert.deepEqual(body.drawn, [url], "the painting, in one blit");
  const overlays = recorder();
  drawBuildingOverlays(overlays.context, winter, home);
  assert.deepEqual(overlays.drawn.filter(drawn => drawn.includes("wave30")),
    [`${variant.key}_weathered`, `${variant.key}_boarded`, `${variant.key}_snow`].map(key => `assets/wave30/house_pair/${key}.png`));
  const marks = recorder();
  drawHouseCondition(marks.context, home, 3, "neglected");
  assert.deepEqual(marks.drawn, [], "no approved wear marks on a Wave 30 painting");
  assert.equal(shownHouseVariantUrl(home, 3), url, "roof smoke and the birds' ridge follow the painting");
  assert.ok(ROOF_SMOKE_ANCHORS[url] !== undefined);
  // Summer, lived in, moved in a season ago: fresh, no boards, no snow.
  const summer: GameState = { ...town, seed, buildings, tick: 12 * 4_000 + 500, houses: houses({}),
    history: { ...DEFAULT_GAME_STATE.history!, records: [record(12 * 4_000 - 500, "person.move_in", home.id)] } };
  beginHouseVariantFrame(summer);
  const fresh = recorder();
  drawBuildingOverlays(fresh.context, summer, home);
  assert.deepEqual(fresh.drawn.filter(drawn => drawn.includes("wave30")), [`assets/wave30/house_pair/${variant.key}_fresh.png`]);
  // Every seed: a Wave 30 painting with its winter snow and its boards, never the approved pair.
  for (let candidate = 0; candidate < 200; candidate += 1) {
    const scene: GameState = { ...winter, seed: candidate };
    beginHouseVariantFrame(scene);
    const drawn = recorder();
    assert.equal(drawHouseCompoundSprite(drawn.context, home, 3), true);
    assert.match(drawn.drawn[0] ?? "", /^assets\/wave30\/house_pair\/house_pair_l3_vertical_[cde]\.png$/, `seed ${candidate}`);
    const layers = recorder();
    drawBuildingOverlays(layers.context, scene, home);
    assert.deepEqual(layers.drawn.filter(url => url.includes("wave30")).map(url => url.replace(/.*_(\w+)\.png$/, "$1")), ["weathered", "boarded", "snow"], `seed ${candidate}`);
  }
});

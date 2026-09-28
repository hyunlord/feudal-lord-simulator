import assert from "node:assert/strict";
import test from "node:test";
import { BREW_ALE_CRAFT_ID } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import { drawBuildingOverlays } from "../src/render/buildingOverlays";
import { historicalHouseAssetManifest } from "../src/render/historicalHouseAssetManifest.generated";
import { drawHistoricalHouse, preloadHistoricalHouseAssets } from "../src/render/historicalHouseAssets";
import { drawHouseCondition } from "../src/render/houseConditionOverlay";
import { rawHouseBody } from "../src/render/houseVariantChoice";
import { beginHouseVariantFrame, preloadWave26HouseLayers, preloadWave26HousePaintings } from "../src/render/wave26HouseArt";
import { WAVE26_HOUSE_IMAGES } from "../src/render/wave26HouseManifest.generated";
import { preloadWave7Art } from "../src/render/wave7Art";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

// INSTALL-26 on the canvas: a household's Wave 26 painting replaces the approved house, its own layers replace Wave 7's
// snow and boards, the approved house's wear marks stay off it, and an alehouse keeps its ale-stake painting.

class LoadedImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  url = "";
  set src(value: string) {
    this.url = value.replace(/^\/+/, "");
    const approved = historicalHouseAssetManifest.find(meta => meta.url === this.url);
    const wave26 = Object.values(WAVE26_HOUSE_IMAGES).find(image => image.url === this.url);
    // The approved paintings load at their declared size; everything else at its manifest size (or a Wave 7 overlay's).
    this.naturalWidth = approved?.width ?? wave26?.width ?? 153;
    this.naturalHeight = approved?.height ?? wave26?.height ?? 153;
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

test("a household's Wave 26 painting, its own layers, no approved wear marks; the alehouse keeps its stake", async () => {
  (globalThis as unknown as { Image: unknown }).Image = LoadedImage;
  await preloadHistoricalHouseAssets();
  await preloadWave26HousePaintings();
  preloadWave26HouseLayers();
  preloadWave7Art();
  await flush();
  const home = DEFAULT_GAME_STATE.buildings.find(building => building.kind === "house" && building.houseLot === undefined)!;
  const seed = [...Array(500).keys()].find(candidate => rawHouseBody(candidate, home.id, 2, "common").variant !== null)!;
  const variant = rawHouseBody(seed, home.id, 2, "common").variant!;
  const lived: House = { ...DEFAULT_GAME_STATE.houses.find(house => house.buildingId === home.id)!, level: 2, builtLevel: 2, residents: 4 };
  const houses = [lived, ...DEFAULT_GAME_STATE.houses.filter(house => house.buildingId !== home.id)];
  // Winter (season 3) of year 12: an old founding house, weathered; abandoned: boarded.
  // No persons (every head common) and no ledger (every house a founding one).
  const { persons: _persons, history: _history, ...town } = DEFAULT_GAME_STATE;
  const state: GameState = { ...town, seed, tick: 12 * 4_000 + 3_500, houses: houses.map(house => house === lived ? { ...house, abandonedTick: 40_000 } : house) };
  beginHouseVariantFrame(state);
  const body = recorder();
  assert.equal(drawHistoricalHouse(body.context, home, 2, state), true);
  assert.deepEqual(body.drawn, [`assets/wave26/house/${variant.key}.png`], "the painting, in one blit");
  const overlays = recorder();
  drawBuildingOverlays(overlays.context, state, home);
  const layers = overlays.drawn.filter(url => url.includes("wave26") || url.includes("wave7/overlay") || url.includes("wave7/season"));
  assert.deepEqual(layers, [`${variant.key}_weathered`, `${variant.key}_boarded`, `${variant.key}_snow`].map(key => `assets/wave26/house/${key}.png`));
  const marks = recorder();
  drawHouseCondition(marks.context, home, 2, "neglected");
  assert.deepEqual(marks.drawn, [], "no approved wear marks on a Wave 26 painting");
  // The same house brewing with ale in its slot is an alehouse: the INSTALL-3 painting, with Wave 7's layers.
  const brewing = [{ craftId: BREW_ALE_CRAFT_ID, workers: 1, input: { malt: 1 }, output: { ale: 2 }, stock: { ale: 3 } }];
  const ale: GameState = { ...state, houses: state.houses.map(house => house.buildingId === home.id ? { ...house, crafts: brewing } : house) };
  beginHouseVariantFrame(ale);
  const stake = recorder();
  drawHistoricalHouse(stake.context, home, 2, ale);
  await flush();
  const again = recorder();
  drawHistoricalHouse(again.context, home, 2, ale);
  assert.equal(again.drawn.length, 1);
  assert.match(again.drawn[0]!, /wave3\/bld\/alehouse_[ab]\.png$/, "the ale-stake painting");
  const aleOverlays = recorder();
  drawBuildingOverlays(aleOverlays.context, ale, home);
  assert.ok(aleOverlays.drawn.some(url => url.includes("wave7/")) && aleOverlays.drawn.every(url => !url.includes("wave26")), aleOverlays.drawn.join());
});

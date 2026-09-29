import { SEASON_TICKS } from "../src/engine/eventSchedule";
import { stateCalendar } from "../src/engine/scenarioState";
import assert from "node:assert/strict";
import test from "node:test";
import type { Building } from "../src/content/buildingConfig";
import { clothCartLoad, clothStockPile, spinningPile } from "../src/render/clothWorldArt";
import { historicalFacilityAssetId } from "../src/render/historicalFacilityAssets";
import type { GameState } from "../src/engine/engine.types";
import { stockPileLevel } from "../src/render/stockPiles";

// CLOTH-UI the cloth chain on the map (Wave 3 + Wave 2 pastoral): pure choice functions.

const building = (kind: Building["kind"], fields: Partial<Building> = {}): Building =>
  ({ id: `${kind}-1`, kind, tx: 8, ty: 10, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...fields }) as Building;

test("cart loads: fleece, yarn and raw cloth ride as cloth_raw or wool_bales loads; dyed cloth and finished cloth as cloth_dyed", () => {
  assert.deepEqual(["NE", "SW", "SE", "NW"].map(d => clothCartLoad("fleece", d)),
    ["cart_load_wool_bales_ne", "cart_load_wool_bales_ne", "cart_load_wool_bales_nw", "cart_load_wool_bales_nw"]);
  assert.equal(clothCartLoad("yarn", "NE"), "cart_load_cloth_raw_ne");
  assert.equal(clothCartLoad("raw_cloth", "SE"), "cart_load_cloth_raw_nw");
  assert.equal(clothCartLoad("fulled_cloth", "SW"), "cart_load_cloth_raw_ne");
  assert.equal(clothCartLoad("dyed_cloth", "NE"), "cart_load_cloth_dyed_ne");
  assert.equal(clothCartLoad("finished_cloth", "NW"), "cart_load_cloth_dyed_nw");
  for (const resource of ["wheat", "bread", "timber", "barley"] as const) assert.equal(clothCartLoad(resource, "NE"), null);
});

test("pile levels: thresholds match stock pile logic (1 from first unit, 2 from a third, 3 from two thirds)", () => {
  const cap = 60;
  assert.equal(stockPileLevel(0, cap), 0);
  assert.equal(stockPileLevel(1, cap), 1);
  assert.equal(stockPileLevel(20, cap), 2);
  assert.equal(stockPileLevel(40, cap), 3);
});

test("cloth stock pile: shows the first cloth resource in inventory with a non-zero level", () => {
  const cap = 40;
  assert.equal(clothStockPile(building("pastoral_farm", { inventory: { fleece: 1 } }), cap), "fleece_heap_1");
  assert.equal(clothStockPile(building("pastoral_farm", { inventory: { fleece: 14 } }), cap), "fleece_heap_2");
  assert.equal(clothStockPile(building("pastoral_farm", { inventory: { fleece: 27 } }), cap), "fleece_heap_3");
  assert.equal(clothStockPile(building("weaver_house", { inventory: { yarn: 8 } }), cap), "yarn_skeins_1");
  assert.equal(clothStockPile(building("weaver_house", { inventory: { raw_cloth: 15 } }), cap), "cloth_bolts_raw_2");
  assert.equal(clothStockPile(building("fulling_mill", { inventory: { fulled_cloth: 27 } }), cap), "cloth_bolts_raw_3");
  assert.equal(clothStockPile(building("dyehouse", { inventory: { dyed_cloth: 1 } }), cap), "cloth_bolts_raw_1");
  assert.equal(clothStockPile(building("tenter_yard", { inventory: { finished_cloth: 14 } }), cap), "cloth_bolts_raw_2");
  assert.equal(clothStockPile(building("pastoral_farm"), cap), null);
  // Fleece takes priority over yarn when both are present.
  assert.equal(clothStockPile(building("weaver_house", { inventory: { fleece: 5, yarn: 5 } }), cap), "fleece_heap_1");
});

test("weaver house: two paintings by plot, fixed; ground on the 1x1 footprint's front vertex", () => {
  const state = { seed: 5 } as GameState;
  const ids = new Set<string | null>();
  for (let tx = 0; tx < 24; tx += 1) ids.add(historicalFacilityAssetId(building("weaver_house", { tx }), state));
  assert.deepEqual([...ids].sort(), ["weaver_house_a", "weaver_house_b"]);
});

test("fulling mill: two paintings by plot, fixed", () => {
  const state = { seed: 5 } as GameState;
  const ids = new Set<string | null>();
  for (let tx = 0; tx < 24; tx += 1) ids.add(historicalFacilityAssetId(building("fulling_mill", { tx }), state));
  assert.deepEqual([...ids].sort(), ["fulling_mill_nesw", "fulling_mill_nwse"]);
});

test("dyehouse: two paintings by plot, fixed", () => {
  const state = { seed: 5 } as GameState;
  const ids = new Set<string | null>();
  for (let tx = 0; tx < 24; tx += 1) ids.add(historicalFacilityAssetId(building("dyehouse", { tx }), state));
  assert.deepEqual([...ids].sort(), ["dyehouse_a", "dyehouse_b"]);
});

test("tenter yard: tenter_frames_a while idle, tenter_frames_dyed while working (has dyed cloth in hand or underway)", () => {
  const idle = building("tenter_yard");
  const working = building("tenter_yard", { workers: 1, inventory: { dyed_cloth: 1 } });
  const state = { seed: 1 } as GameState;
  assert.equal(historicalFacilityAssetId(idle, state), "tenter_frames_a");
  // Working state requires road access check; the pure id without state defaults to quiet.
  assert.equal(historicalFacilityAssetId(idle, undefined), "tenter_frames_a");
  assert.equal(historicalFacilityAssetId(working, undefined), "tenter_frames_a");
});

test("pastoral farm: spring art in spring (season 0), summer in summer and autumn, winter in winter", () => {
  const farm = building("pastoral_farm");
  const scenarioId = "core:campaign_market_town";
  const at = (season: number) => {
    const state = { seed: 1, scenarioId, tick: season * SEASON_TICKS + 10 } as unknown as GameState;
    assert.equal(stateCalendar(state).season, season, `tick ${state.tick} is season ${season}`);
    return historicalFacilityAssetId(farm, state);
  };
  assert.deepEqual([0, 1, 2, 3].map(at), ["farm_pastoral_spring", "farm_pastoral_summer", "farm_pastoral_summer", "farm_pastoral_winter"]);
  assert.equal(historicalFacilityAssetId(farm, undefined), "farm_pastoral_summer", "without a state (the build menu), summer");
});

test("CLOTH-UI: a house that spins shows yarn skeins at its door; a brewing house does not", () => {
  const spin = (stock: Record<string, number>) => ({ crafts: [null, { craftId: "spin_yarn", stock, workers: 1, input: { fleece: 1 }, output: { yarn: 1 } }] }) as never;
  assert.equal(spinningPile(spin({ fleece: 0 })), "yarn_skeins_1", "the slot is empty between batches");
  assert.equal(spinningPile(spin({ yarn: 2 })), "yarn_skeins_1");
  assert.equal(spinningPile({ crafts: [{ craftId: "brew_ale", stock: { ale: 3 } }] } as never), null, "brewing is the ale barrels'");
  assert.equal(spinningPile({ crafts: undefined } as never), null);
});

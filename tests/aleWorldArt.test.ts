import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Walker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import { BREW_ALE_CRAFT_ID } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import { aleBarrelPile, aleCartLoad, alehouseArt, aleStockPile, aleWorkerSheet } from "../src/render/aleWorldArt";
import { fieldStripArt, stripStateKey } from "../src/render/drawArableFields";
import { historicalFacilityAssetId, historicalFacilitySpriteRect } from "../src/render/historicalFacilityAssets";
import { TILE_H, tileToScreen } from "../src/render/iso";
import { residentWalkers } from "../src/render/presentation/residentTrips";
import { millOvenBurning } from "../src/render/roofSmoke";
import { brewingDoor } from "../src/render/villageLife";
import { walkerAppearance } from "../src/render/walkerComposer";
import { walkerSheet } from "../src/render/walkerLook";
import type { ZoneLayer } from "../src/render/zoneLayer";
import { decodeSave } from "../src/save/saveCodec";

// INSTALL-3 the ale chain on the map (Wave 3): the pure choices of which picture shows what the engine holds.

const building = (kind: Building["kind"], fields: Partial<Building> = {}): Building =>
  ({ id: `${kind}-1`, kind, tx: 10, ty: 12, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...fields }) as Building;
const brewing = (ale: number) => [{ craftId: BREW_ALE_CRAFT_ID, workers: 1, input: { malt: 1 }, output: { ale: 2 }, stock: { ale } }];
const house = (level: number, fields: Partial<House> = {}): House =>
  ({ buildingId: "house-1", level, residents: 4, breadStock: 2, ...fields }) as House;

test("barley strips: Wave 3 growing ridges while growing, ripe ridges once ripe; the other stages and wheat keep their art", () => {
  assert.equal(fieldStripArt("barley", "growing", "growing"), "barley_growing");
  assert.equal(fieldStripArt("barley", "ripe", "growing"), "barley_ripe");
  for (const [stage, legacy] of [["sown", "seedling"], ["ploughed", "ploughed"], ["fallow", "fallow"], ["harvested", "harvested"]] as const) {
    assert.equal(fieldStripArt("barley", stage, legacy), legacy, stage);
  }
  for (const [stage, legacy] of [["growing", "growing"], ["ripe", "growing"], ["sown", "seedling"]] as const) assert.equal(fieldStripArt("wheat", stage, legacy), legacy);
  // A barley ridge drawn before its art loads (always in Node) keys its chunk as pending, so the chunk re-rasters once it is in.
  const layer = { arableBands: [{ stripId: "a" }, { stripId: "b" }, { stripId: "c" }] } as unknown as ZoneLayer;
  assert.equal(stripStateKey(layer, [0, 1, 2], new Map([["a", "barley_growing"], ["b", "barley_ripe"], ["c", "growing"]])), "QRg");
});

test("the malt kiln: one of its two paintings per plot, fixed; its ground on the footprint's front vertex at the storehouse's scale", () => {
  const state = { seed: 7 } as GameState;
  const ids = new Set<string | null>();
  for (let tx = 0; tx < 24; tx += 1) {
    const kiln = building("malt_kiln", { tx, ty: 5 });
    const id = historicalFacilityAssetId(kiln, state);
    assert.equal(id, historicalFacilityAssetId({ ...kiln, workers: 2, inventory: { barley: 5 } }, state), "not by its work");
    ids.add(id);
  }
  assert.deepEqual([...ids].sort(), ["malthouse_a", "malthouse_b"]);
  const kiln = building("malt_kiln");
  const rect = historicalFacilitySpriteRect(kiln)!;
  const centre = tileToScreen(kiln.tx + 0.5, kiln.ty + 0.5);
  assert.equal(rect.width, 128);
  assert.equal(rect.x + rect.width / 2, centre.sx);
  // The crop's last row (Astra's pivot row 128) on the front vertex of the 2 x 2 footprint.
  assert.equal(rect.y + rect.height, centre.sy + TILE_H);
  assert.equal(rect.height, 128 * 128 / 160);
});

test("the kiln's flue smokes as a working fire only while it malts (manned, not paused, barley in hand or a batch under way)", () => {
  const kiln = building("malt_kiln", { workers: 2, inventory: { barley: 3 } });
  assert.equal(millOvenBurning(kiln), true);
  assert.equal(millOvenBurning({ ...kiln, workers: 0 }), false);
  assert.equal(millOvenBurning({ ...kiln, inventory: { malt: 4 } }), false);
  assert.equal(millOvenBurning({ ...kiln, inventory: {}, productionProgress: 0.5 }), true);
  assert.equal(millOvenBurning({ ...kiln, operationPaused: true }), false);
});

test("the ale-stake: an alehouse with ale, single lot, drawn at level 2; no ale, no stake", () => {
  const state = { seed: 3 } as GameState;
  const plot = building("house");
  const alehouse = house(2, { crafts: brewing(2) });
  assert.match(alehouseArt(state, plot, alehouse, 2) ?? "", /^alehouse_[ab]$/);
  assert.equal(alehouseArt(state, plot, alehouse, 2), alehouseArt(state, plot, { ...alehouse, crafts: brewing(7) }, 2), "fixed per plot");
  assert.equal(alehouseArt(state, plot, house(2, { crafts: brewing(0) }), 2), null, "sold out: no stake");
  assert.equal(alehouseArt(state, plot, house(2), 2), null, "not brewing");
  assert.equal(alehouseArt(state, plot, house(1, { crafts: brewing(3) }), 1), null, "a level 1 brewer is no alehouse");
  assert.equal(alehouseArt(state, plot, house(3, { crafts: brewing(3) }), 3), null, "level 3: no painting");
  assert.equal(alehouseArt(state, { ...plot, houseLot: "horizontal" } as Building, alehouse, 2), null, "pair lot: no painting");
  assert.equal(alehouseArt(state, plot, undefined, 2), null);
  const variants = new Set(Array.from({ length: 16 }, (_, tx) => alehouseArt(state, { ...plot, tx }, alehouse, 2)));
  assert.deepEqual([...variants].sort(), ["alehouse_a", "alehouse_b"]);
});

test("piles: ale barrels by the slot's ale (cap 8), barley at a barn and malt at the kiln by the store's capacity (Wave 7 thresholds)", () => {
  assert.equal(aleBarrelPile(house(1, { crafts: brewing(0) })), null);
  assert.deepEqual([1, 2, 3, 5, 6, 8].map(ale => aleBarrelPile(house(1, { crafts: brewing(ale) }))),
    ["ale_barrels_1", "ale_barrels_1", "ale_barrels_2", "ale_barrels_2", "ale_barrels_3", "ale_barrels_3"]);
  assert.equal(aleBarrelPile(house(2)), null, "not brewing");
  assert.equal(aleStockPile(building("farmstead", { inventory: { barley: 1 } }), 1000), "barley_sacks_1");
  assert.equal(aleStockPile(building("farmstead", { inventory: { barley: 334 } }), 1000), "barley_sacks_2");
  assert.equal(aleStockPile(building("farmstead", { inventory: { wheat: 400 } }), 1000), null, "wheat keeps its Wave 7 sacks");
  assert.deepEqual([1, 14, 27].map(malt => aleStockPile(building("malt_kiln", { inventory: { malt } }), 40)), ["malt_sacks_1", "malt_sacks_2", "malt_sacks_3"]);
  assert.equal(aleStockPile(building("malt_kiln", { inventory: { barley: 30 } }), 40), null, "the kiln's barley is not shown");
  assert.equal(aleStockPile(building("granary", { inventory: { malt: 30, barley: 30 } }), 200), null);
});

test("cart loads: barley, malt and ale ride as Wave 3's loads, by the cart's axis like Wave 7's", () => {
  assert.deepEqual(["NE", "SW", "SE", "NW"].map(direction => aleCartLoad("barley", direction)),
    ["cart_load_barley_ne", "cart_load_barley_ne", "cart_load_barley_nw", "cart_load_barley_nw"]);
  assert.equal(aleCartLoad("malt", "SE"), "cart_load_malt_nw");
  assert.equal(aleCartLoad("ale", "NE"), "cart_load_ale_barrels_ne");
  for (const resource of ["wheat", "bread", "timber", "coin"] as const) assert.equal(aleCartLoad(resource, "NE"), null);
});

function palisadeTown(): GameState {
  return decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
}

test("walkers: the kiln's carters wear the maltster, the alewife and maltster errands their sheets, any other walker its own look", () => {
  const town = palisadeTown();
  const kiln = building("malt_kiln", { id: "kiln-x", tx: 2, ty: 2, workers: 2 });
  const state = { ...town, buildings: [...town.buildings, kiln] };
  const carter = (home: string): Walker => ({ id: `carter:${home}`, kind: "carter", homeBuildingId: home, position: { tx: 3, ty: 3 }, path: [],
    pathIndex: 0, previousTile: null, cargo: { resource: "barley", amount: 12 }, spawnedTick: 0 }) as unknown as Walker;
  assert.equal(aleWorkerSheet(state, carter("kiln-x")), "wk_maltster");
  const barn = town.buildings.find(candidate => candidate.kind === "farmstead")!;
  assert.equal(aleWorkerSheet(state, carter(barn.id)), null);
  const resident = (occupation: string) => ({ ...carter("x"), kind: "builder", cargo: null, resident: { occupation } }) as unknown as Walker;
  assert.equal(aleWorkerSheet(state, resident("alewife")), "wk_alewife");
  assert.equal(aleWorkerSheet(state, resident("maltster")), "wk_maltster");
  assert.equal(aleWorkerSheet(state, resident("water_fetcher")), null);
  const appearance = walkerAppearance({ ...state, walkers: [carter("kiln-x")] }, carter("kiln-x"));
  assert.equal(appearance.look.sheetId, "wk_maltster");
  assert.equal(appearance.cloak, null, "no winter cloak on the Wave 3 reskins");
  assert.equal(walkerSheet("wk_alewife").sex, "female");
  assert.equal(walkerSheet("wk_maltster").sex, "male");
});

test("a brewing house's woman walks to the store with malt nearest her home once a batch, and her door keeps its spot for the barrels", () => {
  const town = palisadeTown();
  const home = town.houses.filter(candidate => candidate.residents > 0 && (candidate.members?.adults ?? 0) > 0 && candidate.level >= 1)
    .sort((a, b) => a.buildingId.localeCompare(b.buildingId))[0]!;
  const granary = town.buildings.find(candidate => candidate.kind === "granary")!;
  const state: GameState = { ...town,
    houses: town.houses.map(candidate => candidate === home ? { ...candidate, crafts: brewing(2) } : candidate),
    buildings: town.buildings.map(candidate => candidate === granary ? { ...candidate, inventory: { ...candidate.inventory, malt: 5 } } : candidate) };
  const errands = new Map<number, string>();
  for (let tick = state.tick; tick < state.tick + 800; tick += 4) {
    for (const walker of residentWalkers({ ...state, tick })) if (walker.resident.purpose === "malt") errands.set(tick, `${walker.homeBuildingId}|${walker.resident.occupation}`);
  }
  assert.ok(errands.size > 0, "the malt errand walks");
  assert.deepEqual([...new Set(errands.values())], [`${home.buildingId}|alewife`]);
  // Without malt in any store she has no errand.
  const dry = { ...state, buildings: town.buildings };
  assert.equal(Array.from({ length: 200 }, (_, index) => residentWalkers({ ...dry, tick: dry.tick + index * 4 })).flat().some(walker => walker.resident.purpose === "malt"), false);
  const plot = state.buildings.find(candidate => candidate.id === home.buildingId)!;
  const door = brewingDoor(state, home.buildingId);
  // Just outside the house's south-east or south-west face (village life's door spots), or none when both are taken.
  if (door !== null) assert.ok(door.x - plot.tx <= 1.2 && door.y - plot.ty <= 1.2 && door.x - plot.tx >= 0 && door.y - plot.ty >= 0, JSON.stringify(door));
  assert.equal(brewingDoor(town, home.buildingId), null, "a house that does not brew keeps no barrel spot");
});

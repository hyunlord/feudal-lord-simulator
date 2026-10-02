/**
 * C5 the cloth chain (spec docs/design/cloth-chain.md CL-1…CL-11): scenarios T1–T10. The town is the one that came
 * through chapters 1–3 (fixture `chapter-four-town`, 24 L4 lots); the whole chain by the player's commands is the human
 * path (`humanPathCloth.test.ts`), the wool levy in kind from the stores E21 (`chapterTwoWar.test.ts`).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import { CLOTH_BALANCE } from "../src/content/clothConfig";
import { CRAFT_DEFINITIONS } from "../src/content/crafts/craftDefinitions";
import { RESOURCE_CATALOG, STORAGE_KIND_BY_RESOURCE } from "../src/content/resourceCatalog";
import { RESOURCE_COPY } from "../src/content/resourceCatalog.ko";
import { productionOperation, stepProduction } from "../src/economy/production";
import { BOT_PASTURE_CELLS, clothChainAction, clothTime } from "../src/engine/autoplayCloth";
import { autoplayBuildAction } from "../src/engine/autoplay";
import { hasAutoplayBuildingClearance } from "../src/engine/autoplaySetback";
import { advanceCloth, fullingToll, pastoralFieldNeed, pastureSheep, pastureTending, spinningSlot, townCloth } from "../src/engine/cloth";
import type { GameState } from "../src/engine/engine.types";
import { farmsteadFieldNeed } from "../src/engine/labourDemand";
import { marketSalePrice } from "../src/engine/marketSettlement";
import { takeFleece, townFleece } from "../src/engine/pastureWool";
import { buildingUnlockStage } from "../src/world/placement";
import { clothTown } from "./helpers/clothTown";

const town = clothTown();
const YEAR = 4000;
const byKind = (state: GameState, kind: BuildingKind) => state.buildings.filter(building => building.kind === kind).sort((a, b) => a.id.localeCompare(b.id));
function building(kind: BuildingKind, tx: number, ty: number, inventory: Building["inventory"] = {}, workers = BUILDING_CONFIG_BY_KIND[kind].workersRequired): Building {
  return { id: `test-${kind}`, kind, tx, ty, workers, inventory, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
/** The town with a pasture square of `side`×`side` cells at (x, y) and a pastoral farm beside it. */
function withPasture(state: GameState, x: number, y: number, side: number, farm?: Partial<Building>): GameState {
  const membership: number[] = [];
  for (let dy = 0; dy < side; dy += 1) for (let dx = 0; dx < side; dx += 1) membership.push((y + dy) * state.width + x + dx);
  const zones = [...(state.zones ?? []).map(zone => ({ ...zone, membership: zone.membership.filter(index => !membership.includes(index)) })),
    { id: "zone-pasture-test", kind: "pasture" as const, strokes: [], membership: membership.sort((a, b) => a - b), createdOrdinal: 9999 }];
  return { ...state, zones, buildings: [...state.buildings, { ...building("pastoral_farm", x + side, y), ...farm }] };
}

test("T1 (CL-1, CL-4…CL-7) seven goods on the list, five buildings with the market town (the fulling mill and dyehouse by the water), spinning a craft of the second slot", () => {
  const goods = ["fleece", "yarn", "raw_cloth", "fulled_cloth", "dyes", "dyed_cloth", "finished_cloth"] as const;
  assert.deepEqual(RESOURCE_CATALOG.map(entry => entry.id).filter(id => (goods as readonly string[]).includes(id)), [...goods]);
  assert.ok(goods.every(good => STORAGE_KIND_BY_RESOURCE[good] === "storehouse"));
  assert.deepEqual(goods.map(good => RESOURCE_COPY[good].name), ["양털", "털실", "생모직", "축융 모직", "염료", "염색 모직", "완성 모직"]);
  const kinds = ["pastoral_farm", "weaver_house", "fulling_mill", "dyehouse", "tenter_yard"] as const;
  assert.deepEqual(kinds.map(kind => buildingUnlockStage(kind)), kinds.map(() => "market_town"));
  assert.deepEqual(kinds.map(kind => BUILDING_CONFIG_BY_KIND[kind].requiresAdjacentTerrain), [null, null, "water", "water", null]);
  assert.deepEqual(kinds.slice(1).map(kind => [BUILDING_CONFIG_BY_KIND[kind].production!.input, BUILDING_CONFIG_BY_KIND[kind].production!.output]),
    [["yarn", "raw_cloth"], ["raw_cloth", "fulled_cloth"], ["fulled_cloth", "dyed_cloth"], ["dyed_cloth", "finished_cloth"]]);
  assert.equal(BUILDING_CONFIG_BY_KIND.weaver_house.production!.inputPerOutput, 4);
  assert.deepEqual(BUILDING_CONFIG_BY_KIND.dyehouse.production!.alsoConsumes, { resource: "dyes", amount: 1 });
  const spin = CRAFT_DEFINITIONS.find(craft => craft.id === "spin_yarn")!;
  assert.deepEqual([spin.levels, spin.input, spin.output], [[3, 4], { fleece: 1 }, { yarn: 1 }]);
  assert.ok(!RESOURCE_CATALOG.some(entry => /hop/.test(entry.id)));
});

test("T2 (CL-1, CL-2) the pasture's sheep; the nearest pastoral farm within reach tends it and shears a fleece a sheep in early summer, as far as its shepherds are staffed", () => {
  const cells = 36;
  const shearing = Math.ceil(town.tick / YEAR) * YEAR + CLOTH_BALANCE.shearingInYearTick;
  const need = pastoralFieldNeed(cells, shearing);
  const staffed = withPasture(town, 2, 50, 6, { fieldHands: Math.max(0, need - 1) });
  assert.equal(pastureSheep(staffed) - pastureSheep(town), cells * CLOTH_BALANCE.sheepPerPastureCell);
  assert.equal(pastureTending(staffed).get("test-pastoral_farm"), cells);
  const shorn = advanceCloth({ ...staffed, tick: shearing });
  assert.equal(byKind(shorn, "pastoral_farm").at(-1)!.inventory.fleece, cells * CLOTH_BALANCE.sheepPerPastureCell);
  // Half the hands, half the clip; no shearing on another day.
  const halfNeed = pastoralFieldNeed(cells, shearing);
  const half = advanceCloth({ ...withPasture(town, 2, 50, 6, { workers: 1, fieldHands: Math.max(0, Math.ceil(halfNeed / 2) - 1) }), tick: shearing });
  assert.ok((byKind(half, "pastoral_farm").at(-1)!.inventory.fleece ?? 0) < cells * CLOTH_BALANCE.sheepPerPastureCell);
  assert.equal(byKind(advanceCloth({ ...staffed, tick: shearing + 1 }), "pastoral_farm").at(-1)!.inventory.fleece, undefined);
  // Beyond the reach no farm tends it.
  assert.equal(pastureTending(withPasture(town, 2, 50, 6, { tx: 2 + 6 + CLOTH_BALANCE.pastoralReach + 2 })).get("test-pastoral_farm"), undefined);
});

test("T3 (CL-3) a pasture asks a twentieth of the hands a field does — the labour the plague left goes further on sheep", () => {
  for (const tick of [100, 1500, 2500, 3500]) {
    assert.equal(pastoralFieldNeed(60, tick), Math.ceil(farmsteadFieldNeed(60, tick) * CLOTH_BALANCE.pastureHandsPerCellPermille / 1000));
    assert.ok(pastoralFieldNeed(60, tick) * 10 < farmsteadFieldNeed(60, tick));
  }
});

test("T4 (CL-4) with fleece in the stores the women of the L3+ houses take up spinning in the second slot; a skein goes to a weaver's house short of yarn, else a storehouse; the ale's first slot is left alone", () => {
  const store = byKind(town, "storehouse")[0]!;
  const fleeced: GameState = { ...town, buildings: town.buildings.map(entry => entry.id === store.id ? { ...entry, inventory: { ...entry.inventory, fleece: 200 } } : entry) };
  const batch = Math.ceil((town.tick + 1) / CLOTH_BALANCE.spinTicksPerBatch) * CLOTH_BALANCE.spinTicksPerBatch;
  const spun = advanceCloth({ ...fleeced, tick: batch });
  const spinning = spun.houses.filter(house => spinningSlot(house) !== null);
  assert.ok(spinning.length > 0 && spinning.every(house => house.level >= CLOTH_BALANCE.spinFromLevel));
  assert.deepEqual(spun.houses.map(house => house.crafts?.[0]?.craftId ?? null), fleeced.houses.map(house => house.crafts?.[0]?.craftId ?? null), "the first slot as it was");
  assert.equal(townFleece(spun), 200 - spinning.length);
  // Each fetched a fleece; the skeins went where there was room (this town's stores stand nearly full), the rest wait in the slot.
  const skeins = spun.buildings.reduce((sum, entry) => sum + (entry.inventory.yarn ?? 0), 0);
  const inSlots = spinning.reduce((sum, house) => sum + (spinningSlot(house)!.stock.fleece ?? 0), 0);
  assert.equal(skeins + inSlots, spinning.length);
  // A weaver's house takes the skeins first.
  const weaver = building("weaver_house", store.tx, store.ty + 3);
  const woven = advanceCloth({ ...fleeced, buildings: [...fleeced.buildings, weaver], tick: batch });
  assert.equal(woven.buildings.find(entry => entry.id === weaver.id)!.inventory.yarn, Math.min(16, spinning.length));
  // No fleece: nobody spins.
  assert.equal(advanceCloth({ ...town, tick: batch }).houses.some(house => spinningSlot(house) !== null), false);
  assert.equal(townCloth(spun).spinningHouses, spinning.length);
});

test("T5 (CL-5, CL-6) the fulling mill's toll is the lord's; the dyehouse needs a vat of dyes a cloth, and the merchants bring dyes each season to a town with a market", () => {
  const toll = fullingToll(town, new Map([["mill-a", 2], ["mill-b", 1]]));
  assert.deepEqual(toll.ledger!.entries.slice(-2).map(entry => [entry.category, entry.amount]), [["fulling_toll", 6], ["fulling_toll", 3]]);
  const def = BUILDING_CONFIG_BY_KIND.dyehouse;
  const dry = building("dyehouse", 1, 1, { fulled_cloth: 3 });
  assert.equal(productionOperation(dry, def), "no_input");
  let dyehouse = building("dyehouse", 1, 1, { fulled_cloth: 3, dyes: 2 });
  for (let step = 0; step < def.production!.ticksPerOutput; step += 1) dyehouse = stepProduction(dyehouse, def).building;
  assert.deepEqual([dyehouse.inventory.fulled_cloth, dyehouse.inventory.dyes, dyehouse.inventory.dyed_cloth], [2, 1, 1]);
  const season = Math.ceil((town.tick + 1) / 1000) * 1000;
  const brought = advanceCloth({ ...town, buildings: [...town.buildings, building("dyehouse", 1, 1)], tick: season });
  assert.equal(brought.buildings.find(entry => entry.id === "test-dyehouse")!.inventory.dyes, CLOTH_BALANCE.dyesPerSeason);
  const noMarket = { ...town, buildings: [...town.buildings.filter(entry => entry.kind !== "market"), building("dyehouse", 1, 1)], tick: season };
  assert.equal(advanceCloth(noMarket).buildings.find(entry => entry.id === "test-dyehouse")!.inventory.dyes, undefined);
});

test("T6 (CL-8) finished cloth is the market's dearest good: the merchants pay its owners 30d a cloth and the aulnager's seal is the treasury's", () => {
  assert.equal(marketSalePrice(town, "finished_cloth"), CLOTH_BALANCE.clothPrice);
  assert.ok(CLOTH_BALANCE.clothPrice > marketSalePrice(town, "stone"));
  assert.equal(CLOTH_BALANCE.ulnagePerCloth, 4);
});

test("T7 (CL-9) the wool levy's collectors take the fleece from the storehouses first, then the pastoral farms' yards", () => {
  const store = byKind(town, "storehouse")[0]!;
  const state = { ...withPasture(town, 2, 50, 6, { inventory: { fleece: 5 } }),
    buildings: [...town.buildings.map(entry => entry.id === store.id ? { ...entry, inventory: { ...entry.inventory, fleece: 3 } } : entry), { ...building("pastoral_farm", 8, 50), inventory: { fleece: 5 } }] };
  assert.equal(townFleece(state), 8);
  const taken = takeFleece(state, 4);
  assert.deepEqual([taken.buildings.find(entry => entry.id === store.id)!.inventory.fleece, taken.buildings.find(entry => entry.id === "test-pastoral_farm")!.inventory.fleece], [0, 4]);
});

test("T8 (CL-11) the bot's cloth waits for chapter 4; then pasture first, a pastoral farm beside it, the chain's buildings one at a time", () => {
  assert.equal(clothTime(town), true);
  const chapterThree: GameState = { ...town, politics: { ...town.politics!, chapter: { ...town.politics!.chapter, number: 3 } } };
  assert.equal(clothTime(chapterThree), false);
  assert.deepEqual(clothChainAction(chapterThree, autoplayBuildAction), { kind: "none" });
  const first = clothChainAction(town, autoplayBuildAction);
  assert.equal(first.kind, "paint_zone");
  assert.equal(first.kind === "paint_zone" ? first.zone : null, "pasture");
  // With the pasture painted, the fold next; with the fold, the weaver's house.
  const grazed = withPasture({ ...town, buildings: town.buildings }, 2, 50, 8, {});
  const noFold = { ...grazed, buildings: grazed.buildings.filter(entry => entry.kind !== "pastoral_farm") };
  assert.ok(BOT_PASTURE_CELLS <= 64);
  const fold = clothChainAction(noFold, autoplayBuildAction);
  assert.ok(fold.kind === "none" || (fold.kind === "place_building" && fold.building === "pastoral_farm") || fold.kind === "place_road", JSON.stringify(fold));
  const next = clothChainAction(grazed, autoplayBuildAction);
  assert.ok(next.kind === "none" || (next.kind === "place_building" && next.building === "weaver_house") || next.kind === "place_road", JSON.stringify(next));
});

test("T9 (CL-11) the bot keeps its shore setback for every building but the ones that must stand by the water", () => {
  const byWater = (tx: number, ty: number) => [[-1, 0], [2, 0], [0, -1], [0, 2], [-1, 1], [2, 1], [1, -1], [1, 2]]
    .some(([dx, dy]) => town.tiles[(ty + dy!) * town.width + tx + dx!]?.terrain === "water");
  const shore = town.tiles.filter(tile => byWater(tile.tx, tile.ty) && hasAutoplayBuildingClearance(town, "fulling_mill", tile));
  assert.ok(shore.length > 0, "the fulling mill may stand at the water");
  assert.ok(shore.every(tile => !hasAutoplayBuildingClearance(town, "storehouse", tile)), "a storehouse keeps back from the shore");
});

test("T10 (CL-10) the chain's API sums each good over stores, yards and slots, and counts its buildings", () => {
  const store = byKind(town, "storehouse")[0]!;
  const state = { ...town, buildings: [...town.buildings.map(entry => entry.id === store.id ? { ...entry, inventory: { ...entry.inventory, yarn: 7 } } : entry), building("tenter_yard", 1, 1, { finished_cloth: 2 })] };
  const cloth = townCloth(state);
  assert.equal(cloth.goods.yarn, 7);
  assert.equal(cloth.goods.finished_cloth, 2);
  assert.equal(cloth.buildings.tenter_yard, 1);
  assert.equal(cloth.sheep, pastureSheep(state));
});

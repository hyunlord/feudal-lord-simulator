import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BALANCE } from "../src/content/balanceConfig";
import { PASTURE_WOOL } from "../src/content/woolConfig";
import { BREW_ALE_CRAFT_ID, townAle } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import { woolInKindPerSeason, woolLevyAmount } from "../src/engine/war";
import { decodeSave } from "../src/save/saveCodec";
import { farmsteadCropModel } from "../src/ui/farmsteadCropModel";
import { LedgerDrawer } from "../src/ui/hud/HudShell";
import { petitionPresentation } from "../src/ui/petitionPresentation";
import { storeInspectorModel } from "../src/ui/storeInspectorModel";
import { TOWN_ALE_COPY } from "../src/ui/townAleCopy.ko";
import { townAleView } from "../src/ui/townAleModel";

// ECON-UI (engine FIX-7): the town's ale on the ledger drawer, the stores and the season card; the barn's barley lock
// with its reason; the wool levy's in-kind line (the pastures' fleeces first, the rest in coin).
const load = (name: string) => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v26/${name}.save.json`))).envelope.state as GameState;
const SEASON = BALANCE.TICKS_PER_YEAR / 4;

/** The chapter 2 town with two brewing houses (casks in their first slot) and a closed season of ale counted. */
function aleTown(): GameState {
  const town = load("palisade-construction");
  const brewers = new Set(town.houses.filter(house => house.residents > 0).slice(0, 2).map(house => house.buildingId));
  const slot = (ale: number) => ({ craftId: BREW_ALE_CRAFT_ID, workers: 1, input: {}, output: {}, stock: { ale } });
  const seasonStart = Math.floor(town.tick / SEASON) * SEASON;
  return {
    ...town,
    houses: town.houses.map((house, index) => brewers.has(house.buildingId) ? { ...house, crafts: [slot(index === 0 ? 4 : 3)] } : house),
    ale: { current: { startTick: seasonStart, brewed: 2, maltUsed: 2, drunk: 1, sold: 1 }, last: { startTick: seasonStart - SEASON, brewed: 10, maltUsed: 7, drunk: 22, sold: 11 } },
  } as GameState;
}

test("the town's ale in words: the casks (in the houses, of them the alehouses'), the brewing houses, this and last season", () => {
  const state = aleTown();
  const ale = townAle(state);
  const view = townAleView(state)!;
  assert.equal(view.stock, TOWN_ALE_COPY.stock(ale.stock, ale.inAlehouses));
  assert.ok(ale.stock >= 7);
  assert.equal(view.thisSeason, TOWN_ALE_COPY.thisSeason(TOWN_ALE_COPY.season(2, 1, 1)));
  assert.equal(view.lastSeason, TOWN_ALE_COPY.lastSeason(TOWN_ALE_COPY.season(10, 22, 11)));
  assert.equal(view.closedSeason, TOWN_ALE_COPY.closedSeason(TOWN_ALE_COPY.season(10, 22, 11)));
  // A town that never brewed has none.
  assert.equal(townAleView(load("palisade-construction")), null);
});

test("the ledger drawer's stock tab shows the town's ale; a store's card says the ale is kept in the houses", () => {
  const state = aleTown();
  const html = renderToStaticMarkup(createElement(LedgerDrawer, { state, onInspect: () => undefined, onClose: () => undefined, viewTab: null, mapTab: null }));
  assert.match(html, /ledger-town-ale/);
  assert.ok(html.includes(townAleView(state)!.stock) && html.includes(townAleView(state)!.lastSeason!));
  const store = state.buildings.find(building => building.kind === "granary" || building.kind === "storehouse")!;
  assert.equal(storeInspectorModel(state, store.id, null)!.aleNote, townAleView(state)!.inHouses);
  assert.equal(storeInspectorModel(load("palisade-construction"), store.id, null)!.aleNote, null);
});

test("barley waits for the malt kiln: before the market town the choice is disabled with the engine's reason", () => {
  const hamlet = load("four-farms");
  const barn = hamlet.buildings.find(building => building.kind === "farmstead")!;
  const locked = farmsteadCropModel(hamlet, barn.id)!;
  assert.equal(locked.disabled, true);
  assert.equal(locked.locked, "엿기름 가마는 시장도시부터");
  // A barn already in barley (an older save) can go back to wheat.
  const inBarley = { ...hamlet, buildings: hamlet.buildings.map(building => building.id === barn.id ? { ...building, crop: "barley" as const } : building) };
  assert.equal(farmsteadCropModel(inBarley, barn.id)!.disabled, false);
  const town = load("palisade-construction");
  const open = farmsteadCropModel(town, town.buildings.find(building => building.kind === "farmstead")!.id)!;
  assert.deepEqual([open.disabled, open.locked], [false, null]);
});

test("the wool levy's in-kind answer says what a season takes: the pastures' fleeces first, the rest in coin", () => {
  const town = load("palisade-construction");
  const petition = { id: "petition-test", defId: "wool_payment", petitioner: "crown", subject: "wool_payment", createdTick: town.tick, status: "open" } as never;
  const perSeason = woolInKindPerSeason(woolLevyAmount(town));
  const line = (state: GameState) => petitionPresentation(state, petition).line("accept");
  assert.match(line(town), /목초지 양털이 없어 계절마다 \d+d 모두 현금/);
  const pasture = town.zones!.find(zone => zone.kind === "pasture");
  // With pastures enough for part of the share: fleeces and coin.
  const cells = Math.ceil(perSeason / PASTURE_WOOL.fleeceValue) * 2; // half the share's fleeces (a season is a quarter of a year's clip)
  const withPasture = { ...town, zones: [...(town.zones ?? []).filter(zone => zone !== pasture), { id: "pasture-test", kind: "pasture", membership: Array.from({ length: cells }, (_, index) => index) }] } as unknown as GameState;
  assert.match(line(withPasture), /계절마다 양털 \d+뭉치\(\d+d\)( \+ 현금 \d+d|로 다 냅니다)/);
});

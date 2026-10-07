import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BALANCE } from "../src/content/balanceConfig";
import { CLOTH_BALANCE } from "../src/content/clothConfig";
import { BREW_ALE_CRAFT_ID, townAle } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import { initialPolitics } from "../src/engine/politics";
import { woolInKindPerSeason, woolLevyAmount } from "../src/engine/war";
import { decodeSave } from "../src/save/saveCodec";
import { farmsteadCropModel } from "../src/ui/farmsteadCropModel";
import { LedgerDrawer } from "../src/ui/hud/HudShell";
import { petitionCard } from "../src/ui/decisionCard/families/petitionCard";
import { storeInspectorModel } from "../src/ui/storeInspectorModel";
import { TOWN_ALE_COPY } from "../src/ui/townAleCopy.ko";
import { townAleView } from "../src/ui/townAleModel";
import { moneyShort } from "../src/ui/money.ko";

// ECON-UI (engine FIX-7): the town's ale on the ledger drawer, the stores and the season card; the barn's barley lock
// with its reason; the wool levy's in-kind line (the town's stored fleece first — C5 CL-9 —, the rest in coin).
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

test("the wool levy's in-kind answer says what a season takes: the town's stored fleece first, the rest in coin", () => {
  const town = load("palisade-construction");
  // DEC-CARD: the in-kind answer's card (the petition open on the town) says it among what follows.
  const open = (state: GameState): GameState => ({ ...state, politics: { ...(state.politics ?? initialPolitics(state)),
    petitions: [{ id: "wool_payment@1", defId: "wool_payment", petitioner: "crown", arrivedTick: state.tick }] } });
  const perSeason = woolInKindPerSeason(woolLevyAmount(town));
  const line = (state: GameState) => petitionCard(open(state))!.card.choices.find(choice => choice.id === "accept")!.later.join(" ");
  assert.ok(line(town).includes(`양털이 없어, 한 몫 ${moneyShort(perSeason)}`), line(town));
  // Fleece for half the share in a storehouse (C5 CL-9: the levy takes it from the stores).
  const half = Math.floor(perSeason / CLOTH_BALANCE.fleeceValue / 2);
  const store = town.buildings.find(building => building.kind === "storehouse")!;
  const stocked = { ...town, buildings: town.buildings.map(building => building.id === store.id ? { ...building, inventory: { ...building.inventory, fleece: half } } : building) } as GameState;
  assert.ok(line(stocked).includes(`한 몫은 창고 양털 ${half}뭉치(${moneyShort(half * CLOTH_BALANCE.fleeceValue)})와 현금 ${moneyShort(perSeason - half * CLOTH_BALANCE.fleeceValue)}`), line(stocked));
});

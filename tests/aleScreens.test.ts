/**
 * INSTALL-3 UI: the ale chain on the screens — the barn's crop select (the game command `set_farmstead_crop`), barley,
 * malt and ale with their Wave 3 icons wherever goods are listed, the house's rise with and without ale (the engine's
 * `aleHoldTicks`), the season card's ale cause and the bot's label. The town is the C4 human path's
 * (tests/humanPathAle.test.ts): the palisade-construction save in chapter 2.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ALE_BALANCE } from "../src/content/aleConfig";
import { CHAPTER_TWO } from "../src/content/chapterConfig";
import { HOUSING_CONFIG } from "../src/content/housingConfig";
import { RESOURCE_CATALOG, RESOURCE_CHAIN_SHEET_CELLS, resourceEntry } from "../src/content/resourceCatalog";
import { aleServedHouses } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import { initialPolitics } from "../src/engine/politics";
import { advanceTick } from "../src/engine/tick";
import { aleHoldTicks } from "../src/population/housing";
import { buildingInspectorModel } from "../src/render/buildingInspectorModel";
import { DiagnosticCard } from "../src/render/DiagnosticCard";
import { WAVE3_ALE_IMAGES } from "../src/render/wave3AleManifest.generated";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { autoplayActionLabel } from "../src/ui/autoplayPresentation";
import { FARMSTEAD_CROP_COPY } from "../src/ui/farmsteadCropCopy.ko";
import { farmsteadCropAction, farmsteadCropModel } from "../src/ui/farmsteadCropModel";
import { LedgerDrawer } from "../src/ui/hud/HudShell";
import { HOUSE_ALE_COPY } from "../src/ui/houseAleCopy.ko";
import { houseAleProgressLine, housesWaitingForAle } from "../src/ui/houseAleModel";
import { houseDiagnosisModel } from "../src/ui/houseDiagnosisModel";
import { buildingCauseSnapshot, houseProgressModel, progressClock, type HouseProgressModel } from "../src/ui/houseProgressModel";
import { placementChipModel } from "../src/ui/placementChip";
import { PredictionPanel } from "../src/ui/PredictionPanel";
import { ResourceGlyph } from "../src/ui/ResourceArtwork";
import { StoreInspectorBody } from "../src/ui/StoreInspector";
import { storeInspectorModel } from "../src/ui/storeInspectorModel";
import { seasonLedgerCardModel } from "../src/ui/seasonLedgerCard";
import { arableLayouts, reconcileArableFields, stripTending } from "../src/zones/arableFields";

const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
function chapterTwo(): GameState {
  const politics = initialPolitics(saved);
  return { ...saved, politics: { ...politics, chapter: { ...politics.chapter, number: CHAPTER_TWO.chapter } } };
}
const houseModels = (state: GameState) => [...buildingCauseSnapshot(state).values()].filter((model): model is HouseProgressModel => "currentLevel" in model);

test("barley, malt and ale are drawn from the Wave 3 chain sheet's first three cells", () => {
  const sheet = WAVE3_ALE_IMAGES.icon_resource_chain_sheet;
  assert.equal(RESOURCE_CHAIN_SHEET_CELLS.length, sheet.width / sheet.height, "ten 96 px cells in one row");
  // CL10: the cloth chain's goods now also have chain-sheet cells; the ale chain's three come first in the catalog.
  const aleGoods = RESOURCE_CATALOG.filter(entry => (["barley", "malt", "ale"] as string[]).includes(entry.id));
  assert.deepEqual(aleGoods.map(entry => [entry.id, resourceEntry(entry.id).chainCell]),
    [["barley", "barley"], ["malt", "malt"], ["ale", "ale"]]);
  for (const [resource, index] of [["barley", 0], ["malt", 1], ["ale", 2]] as const) {
    const markup = renderToStaticMarkup(createElement(ResourceGlyph, { resource }));
    assert.match(markup, new RegExp(`data-icon="chain.${resource}"`), resource);
    assert.match(markup, /assets\/wave3\/icons\/icon_resource_chain_sheet\.png/, resource);
    assert.match(markup, new RegExp(`background-position:${index === 0 ? "0" : `-${index * 24}`}px 0`), resource);
    assert.match(markup, /background-size:240px 24px/, resource);
  }
  // The UX-2 goods keep their sheet; a good with neither draws nothing beside its name.
  assert.match(renderToStaticMarkup(createElement(ResourceGlyph, { resource: "bread" })), /data-icon="resource.bread"/);
  assert.equal(renderToStaticMarkup(createElement(ResourceGlyph, { resource: "wheat" })), "");
});

test("the barn's crop select sends set_farmstead_crop and says a change is sown from the next sowing", () => {
  let state = chapterTwo();
  const barn = state.buildings.filter(building => building.kind === "farmstead").sort((a, b) => a.id.localeCompare(b.id))[0]!;
  const before = farmsteadCropModel(state, barn.id)!;
  assert.equal(before.crop, "wheat");
  assert.deepEqual(before.options, [{ value: "wheat", label: "밀" }, { value: "barley", label: "보리" }]);
  assert.equal(before.current, FARMSTEAD_CROP_COPY.current("밀"));
  assert.equal(before.note, FARMSTEAD_CROP_COPY.note);
  assert.equal(before.pending, null, "its strips carry its own crop");
  assert.equal(farmsteadCropModel(state, state.buildings.find(building => building.kind === "house")!.id), null);
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, { position: { x: 8, y: 8 },
    model: { kind: "building", value: buildingInspectorModel(state, barn.id)! }, farmsteadCrop: { model: before, onChange: () => undefined } }));
  assert.match(markup, /aria-label="헛간 작물: 밀"/);
  assert.ok(markup.includes(FARMSTEAD_CROP_COPY.note));
  assert.doesNotMatch(markup, /<select/);

  const action = farmsteadCropAction(barn.id, "barley");
  assert.deepEqual(action, { type: "set_farmstead_crop", buildingId: barn.id, crop: "barley" });
  state = gameReducer(state, action);
  assert.equal(state.buildings.find(building => building.id === barn.id)!.crop, "barley");
  const after = farmsteadCropModel(state, barn.id)!;
  assert.equal(after.crop, "barley");
  // The strips already in the ground keep their wheat until harvested (the engine sows the barn's crop at sowing).
  const layouts = arableLayouts(state); const tending = stripTending(state, layouts);
  const wheat = reconcileArableFields(state, layouts).flatMap(field => field.strips)
    .filter(strip => tending.get(strip.id)?.farmsteadId === barn.id && ["sown", "growing", "ripe"].includes(strip.stage) && strip.crop === "wheat").length;
  assert.ok(wheat > 0);
  assert.equal(after.pending, FARMSTEAD_CROP_COPY.pending("밀", wheat, "보리"));
  const left = Math.floor(state.buildings.find(building => building.id === barn.id)!.inventory.wheat ?? 0);
  assert.equal(after.carting, left > 0 ? FARMSTEAD_CROP_COPY.carting("밀", left) : null);
});

test("a house's rise waits the engine's ale hold: half as long again unserved, the level's hold served", () => {
  const state = chapterTwo();
  const models = houseModels(state).filter(model => model.ale !== undefined);
  assert.ok(models.length > 0);
  for (const model of models) {
    const next = HOUSING_CONFIG.find(definition => definition.level === model.nextLevel)!;
    assert.ok(next.level >= ALE_BALANCE.requiredFromLevel);
    assert.equal(model.ale!.served, false, "no house drinks before the chain");
    assert.equal(model.requiredTicks, aleHoldTicks(next, false));
    assert.equal(model.ale!.holdTicks, Math.ceil(next.promotionHoldTicks * ALE_BALANCE.unservedHoldPermille / 1000));
    assert.equal(model.ale!.baseTicks, next.promotionHoldTicks);
  }
  const ready = models.find(model => model.status === "ready")!;
  assert.equal(houseAleProgressLine(ready), HOUSE_ALE_COPY.unservedReady(ready.nextLevel!, progressClock(ready.ale!.holdTicks), progressClock(ready.ale!.baseTicks)));
  assert.equal(houseDiagnosisModel(state, ready.buildingId)?.ale?.served, false);

  // Served (the house drank this season): the level's own hold, and the line says so.
  const served: GameState = { ...state, houses: state.houses.map(house => house.buildingId === ready.buildingId ? { ...house, aleUntilTick: state.tick + 100 } : house) };
  assert.ok(aleServedHouses(served).has(ready.buildingId));
  const drank = houseProgressModel(served, ready.buildingId)!;
  assert.equal(drank.ale?.served, true);
  assert.equal(drank.requiredTicks, HOUSING_CONFIG.find(definition => definition.level === drank.nextLevel)!.promotionHoldTicks);
  assert.equal(houseAleProgressLine(drank), HOUSE_ALE_COPY.served);
  assert.deepEqual(houseDiagnosisModel(served, ready.buildingId)?.ale, { served: true, label: HOUSE_ALE_COPY.conditionServed });

  // Chapter 1: ale asks nothing (no line, no condition, the level's hold).
  const early = houseModels(saved);
  assert.ok(early.every(model => model.ale === undefined));
  assert.equal(houseDiagnosisModel(saved, ready.buildingId)?.ale, undefined);
  const card = renderToStaticMarkup(createElement(DiagnosticCard, { position: { x: 8, y: 8 }, causeSummary: ready,
    model: { kind: "house", value: houseDiagnosisModel(state, ready.buildingId)! } }));
  assert.ok(card.includes(houseAleProgressLine(ready)!));
  assert.match(card, /data-ale-condition="unserved"/);
});

test("the season card names the houses waiting longer for want of ale, and the ale chain's goods held", () => {
  let state = chapterTwo();
  const closes = state.seasons!.history.length;
  while (state.seasons!.history.length === closes) state = advanceTick(state);
  const waiting = housesWaitingForAle(state);
  assert.ok(waiting > 0);
  const card = seasonLedgerCardModel(state)!;
  assert.ok(card.events.includes(HOUSE_ALE_COPY.seasonWaiting(waiting)), JSON.stringify(card.events));
  assert.deepEqual(card.drink, [], "no barley, malt or ale yet");
  const barn = state.buildings.find(building => building.kind === "farmstead")!;
  const held: GameState = { ...state, buildings: state.buildings.map(building => building === barn ? { ...barn, inventory: { ...barn.inventory, barley: 7 } } : building) };
  const withBarley = seasonLedgerCardModel(held)!;
  assert.deepEqual(withBarley.drink.map(item => [item.resource, item.amount]), [["barley", 7], ["malt", 0], ["ale", 0]]);
  assert.equal(withBarley.drinkLine, "지금 영지에: 보리 7 · 엿기름 0 · 에일 0");
});

test("barley and malt show with their icons in the ledger drawer, the stores, a barn's stock and the kiln's chip", () => {
  const state = chapterTwo();
  const barn = state.buildings.find(building => building.kind === "farmstead")!;
  // FIX-8 (FX8-1): malt is kept in the storehouse.
  const storehouse = state.buildings.find(building => building.kind === "storehouse")!;
  const stocked: GameState = { ...state, buildings: state.buildings.map(building => building === barn ? { ...barn, inventory: { ...barn.inventory, barley: 12 } }
    : building === storehouse ? { ...storehouse, inventory: { ...storehouse.inventory, malt: 3 } } : building) };
  const drawer = renderToStaticMarkup(createElement(LedgerDrawer, { state: stocked, onInspect: () => undefined, onClose: () => undefined, viewTab: null, mapTab: null }));
  assert.match(drawer, /data-resource="barley"[^]*?data-icon="chain.barley"/);
  assert.match(drawer, /data-resource="malt"[^]*?data-icon="chain.malt"/);
  const store = renderToStaticMarkup(createElement(StoreInspectorBody, { model: storeInspectorModel(stocked, storehouse.id, null)! }));
  assert.match(store, /data-resource="malt"[^]*?data-icon="chain.malt"/);
  const facility = buildingInspectorModel(stocked, barn.id)!;
  assert.ok(facility.stock!.some(item => item.resource === "barley" && item.amount === 12));
  assert.ok(facility.rows.includes(facility.stockRow!));
  const barnCard = renderToStaticMarkup(createElement(DiagnosticCard, { position: { x: 8, y: 8 }, model: { kind: "building", value: facility } }));
  assert.match(barnCard, /class="inspector-stock-item" data-resource="barley"><span class="ui-icon resource-glyph" aria-hidden="true" data-icon="chain.barley"/);
  assert.match(barnCard, /보리 12/);
  const chip = placementChipModel(stocked, { tool: "malt_kiln", reachHouses: null });
  assert.deepEqual(chip.production, { input: "barley", output: "malt", text: "재료 보리 · 만듦 엿기름" });
  const panel = renderToStaticMarkup(createElement(PredictionPanel, { lines: [], position: { x: 0, y: 0 }, chip }));
  assert.match(panel, /data-icon="chain.barley"[^]*data-icon="chain.malt"/);
  assert.equal(placementChipModel(stocked, { tool: "well", reachHouses: 0 }).production, null);
});

test("the bot's turn of a barn to barley has its own label", () => {
  assert.equal(autoplayActionLabel({ kind: "set_farmstead_crop", buildingId: "farmstead-1", crop: "barley" }), "다음: 헛간 작물을 보리로");
  assert.equal(autoplayActionLabel({ kind: "set_farmstead_crop", buildingId: "farmstead-1", crop: "wheat" }), "다음: 헛간 작물을 밀로");
  assert.equal(autoplayActionLabel({ kind: "place_building", building: "malt_kiln", tx: 1, ty: 1 }), "다음: 엿기름 가마 건설");
  assert.equal(autoplayActionLabel({ kind: "none" }), "다음: 대기");
});

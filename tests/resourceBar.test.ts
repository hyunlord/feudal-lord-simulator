import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { createConstructionSite } from "../src/economy/construction";
import { placementSpendableResource } from "../src/world/placement";
import { ResourceBar } from "../src/ui/ResourceBar";

function render(state: GameState, open = false): string {
  return renderToStaticMarkup(createElement(ResourceBar, { state, populationDrawerOpen: open, onPopulationDrawerToggle: () => undefined }));
}

test("resource bar presents all current stocks including stone and transported cargo without counting reservations", () => {
  const html = render({
    ...DEFAULT_GAME_STATE,
    population: 28,
    idleWorkers: 9,
    treasuryTimber: 13,
    treasuryCoin: 17,
    buildings: [{ id: "stock", kind: "storehouse", tx: 1, ty: 1, workers: 0, inventory: { timber: 6, logs: 23, bread: 31, wheat: 37, stone: 41, stone_raw: 43, coin: 2 }, reserved: { timber: 500 }, stockReserved: { logs: 10 }, productionProgress: 0 }],
    walkers: [{ id: "delivery", kind: "distributor", homeBuildingId: "granary", phase: "roaming", position: { tx: 1, ty: 1 }, path: [], pathIndex: 0, previousTile: null, cargo: { resource: "bread", amount: 7 }, spawnedTick: 0, junctionVisits: 0, tilesTravelled: 0, priorTile: null }],
  });
  for (const [label, value] of [["인구", 28], ["빵", 38], ["가용 목재", 19], ["가용 석재", 41], ["재정", 19]]) {
    assert.ok(html.includes(`<span>${label}</span><strong>${value}</strong>`));
  }
  for (const text of ["밀 37", "원목 23", "원석 43", "유휴 일꾼 <b>9</b>", "운송 중인 물량 포함"]) assert.ok(html.includes(text));
  assert.ok(!html.includes("500"));
});

test("resource bar keeps zero resources visible and population drawer state accessible", () => {
  const state = { ...DEFAULT_GAME_STATE, buildings: [], walkers: [], population: 0, idleWorkers: 0, treasuryTimber: 0, treasuryCoin: 0 };
  const html = render(state, true);
  assert.equal((html.match(/<strong>0<\/strong>/g) ?? []).length, 5);
  assert.ok(html.includes('aria-expanded="true"'));
  assert.ok(html.includes('aria-controls="population-ledger-drawer"'));
  assert.ok(render(state).includes('aria-expanded="false"'));
});

test("Given a paused city When resource bar renders Then trend rows stay blank", () => {
  const html = renderToStaticMarkup(createElement(ResourceBar, {
    state: DEFAULT_GAME_STATE, paused: true, populationDrawerOpen: false, onPopulationDrawerToggle: () => undefined,
  }));
  assert.doesNotMatch(html, /일시정지/);
  assert.doesNotMatch(html, /관측 중/);
});

test("Given stocked bread When resource bar renders Then food duration has explicit game-time units", () => {
  const house = DEFAULT_GAME_STATE.houses[0];
  assert.ok(house);
  const html = render({ ...DEFAULT_GAME_STATE, houses: [{ ...house, residents: 8 }],
    buildings: [{ id: house.buildingId, kind: "house", tx: 0, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
      { id: "granary", kind: "granary", tx: 1, ty: 0, workers: 0, inventory: { bread: 4 }, reserved: {}, stockReserved: {}, productionProgress: 0 }],
  });
  assert.match(html, /1가구 기준 약 1분/);
  assert.doesNotMatch(html, /가구분 · 1끼/);
});


test("construction resource headlines show buildable stock after actual reservations", () => {
  const state: GameState = {
    ...DEFAULT_GAME_STATE,
    treasuryTimber: 10,
    constructionSites: [createConstructionSite({ ordinal: 1, kind: "well", tx: 3, ty: 3, startedTick: 0 })],
    buildings: [{ id: "stock", kind: "storehouse", tx: 1, ty: 1, workers: 0, inventory: { stone: 41 }, reserved: {}, stockReserved: { stone: 41 }, productionProgress: 0 }],
    walkers: [],
  };
  assert.equal(placementSpendableResource(state, "timber"), 0);
  assert.equal(placementSpendableResource(state, "stone"), 0);
  const html = render(state);
  assert.ok(html.includes("<span>가용 목재</span><strong>0</strong>"));
  assert.ok(html.includes("<span>가용 석재</span><strong>0</strong>"));
  assert.ok(html.includes("목재 전체 보유량 10 · 건설 가능 0"));
  assert.ok(html.includes("석재 전체 보유량 41 · 건설 가능 0"));
  assert.ok(html.includes("실제 예약·운송 중 물량 제외"));
});

test("LB-9 the population cell's idle count is the adults no demand took (labour.idle), not the facility pool", () => {
  const html = render({ ...DEFAULT_GAME_STATE, population: 40, idleWorkers: 14,
    labour: { adults: 20, facility: 6, construction: 0, fieldHands: 9, hauling: 1, household: 0, idle: 4 } });
  assert.ok(html.includes("유휴 일꾼 <b>4</b>"));
  assert.ok(!html.includes("유휴 일꾼 <b>14</b>"));
});

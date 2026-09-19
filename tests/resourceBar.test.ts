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


test("construction resource headlines show spendable stock after commitments and reservations", () => {
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
  assert.ok(html.includes("공사 약정·예약 물량과 운송 중인 물량 제외"));
});

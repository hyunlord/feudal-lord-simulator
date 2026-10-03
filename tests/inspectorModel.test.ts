import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { Inspector } from "../src/ui/InspectorView";
import { inspectorModel } from "../src/ui/inspectorModel";
import { seedGroundState } from "../scripts/boundaryFixtureStates";
import { building, state as makeState } from "./stoneWallConversionFixtures";

function runTicks(state: GameState, ticks: number): GameState {
  let next = state;
  for (let index = 0; index < ticks; index += 1) next = advanceTick(next);
  return next;
}

const FRESH = runTicks(DEFAULT_GAME_STATE, 25);
const NO_WELL = { ...FRESH, buildings: FRESH.buildings.filter((candidate) => candidate.kind !== "well") };

function cityWithoutWheat(): GameState {
  const city = seedGroundState(2);
  return { ...city, tick: 1_000, buildings: city.buildings.map((candidate) => ({ ...candidate, inventory: { ...candidate.inventory, wheat: 0 } })) };
}

test("no selection or an unknown id shows nothing", () => {
  assert.equal(inspectorModel(FRESH, null), null);
  assert.equal(inspectorModel(FRESH, "missing-building"), null);
  assert.equal(renderToStaticMarkup(createElement(Inspector, { state: FRESH, buildingId: null, onClose: () => undefined })), "");
  assert.equal(renderToStaticMarkup(createElement(Inspector, { state: FRESH, buildingId: "missing", onClose: () => undefined })), "");
});

test("a mill without wheat: block line first, then what to do", () => {
  // Given
  const state = cityWithoutWheat();
  const mill = state.buildings.find((candidate) => candidate.kind === "mill")!;

  // When
  const model = inspectorModel(state, mill.id);

  // Then
  assert.equal(model?.name, "방앗간");
  assert.match(model?.stateLine ?? "", /^일꾼 \d+\/\d+ · 멈춤$/);
  assert.deepEqual(model?.why[0], { text: "곡창에 밀 재고가 없습니다", block: true });
  assert.deepEqual(model?.actions, ["밀밭·헛간을 늘려 밀을 확보하세요"]);
});

test("a cottage without a well: the water cause blocks and the action is to build a well", () => {
  // When
  const model = inspectorModel(NO_WELL, "house-44-40-0");

  // Then
  assert.equal(model?.target, "building");
  assert.match(model?.stateLine ?? "", /^오두막 · 주민 \d+명 · L1 승급 막힘$/);
  assert.deepEqual(model?.why[0], { text: "우물이 없습니다", block: true });
  assert.equal(model?.why.filter((line) => line.block).length, 1);
  assert.deepEqual(model?.actions, ["이 집 가까이에 우물을 지으세요"]);
});

test("a healthy building has no cause and no action", () => {
  const model = inspectorModel(FRESH, "house-44-40-0");
  assert.deepEqual(model?.why, []);
  assert.deepEqual(model?.actions, []);
});

test("a paused facility says how to resume", () => {
  const state = cityWithoutWheat();
  const sawmill = state.buildings.find((candidate) => candidate.kind === "sawmill")!;
  const paused = { ...state, buildings: state.buildings.map((candidate) => candidate.id === sawmill.id ? { ...candidate, operationPaused: true } : candidate) };
  const model = inspectorModel(paused, sawmill.id);
  assert.deepEqual(model?.why[0], { text: "시설 가동 중지", block: true });
  assert.deepEqual(model?.actions, ["'가동 재개' 버튼으로 다시 가동하세요"]);
});

test("a construction site off the road names the site, its stall and the road to lay", () => {
  // Given: the construction-access fixture (a well plan with no road next to it).
  const site = {
    id: "well-plan", kind: "well", tx: 5, ty: 5, required: { timber: 10 }, delivered: {}, reserved: {},
    builderTicks: 0, requiredBuilderTicks: 200, assignedBuilders: 1, stall: "no_route", startedTick: 0,
  } as const satisfies ConstructionSite;
  const state = makeState({
    tick: 100, width: 8, height: 8, palisade: null, houses: [], walkers: [],
    buildings: [building("store", "storehouse", 1, 1, { inventory: { timber: 20 } })],
    constructionSites: [site],
    tiles: Array.from({ length: 64 }, (_, index) => {
      const tx = index % 8, ty = Math.floor(index / 8);
      return { tx, ty, terrain: "grass" as const, hasRoad: tx === 2 && ty === 3,
        buildingId: tx >= 1 && tx <= 2 && ty >= 1 && ty <= 2 ? "store" : tx === 5 && ty === 5 ? site.id : null };
    }),
  });

  // When
  const model = inspectorModel(state, site.id);

  // Then
  assert.equal(model?.target, "site");
  assert.equal(model?.name, "우물 부지");
  assert.equal(model?.stateLine, "🚧 도로 미연결");
  assert.deepEqual(model?.why, [{ text: "공사장까지 길이 이어지지 않았습니다", block: true }]);
  assert.equal(model?.actions.length, 1);
  assert.match(model?.actions[0] ?? "", /공사장에 연결/);
});

test("the inspector renders name, state line, 왜?/조치 and a close button", () => {
  // When
  const markup = renderToStaticMarkup(createElement(Inspector, { state: NO_WELL, buildingId: "house-44-40-0", onClose: () => undefined }));

  // Then
  assert.match(markup, /<h2>오두막<\/h2>/);
  assert.match(markup, /<h3>왜\?<\/h3>/);
  assert.match(markup, /<h3>조치<\/h3>/);
  assert.match(markup, /class="left-inspector-line left-inspector-line--block">우물이 없습니다</);
  assert.match(markup, /<button type="button" class="left-inspector-close ui-btn[^"]*" aria-label="닫기">/);
});

test("UI-AUDIT-1: a barn the stuck-goods chip reports says the chip's reason and what to do, not '지금 할 일이 없습니다'", () => {
  // Given: the chip's row for a barn (its harvest lost behind the full barn, the cart not keeping up; LM-R1: the engine's
  // field entry); the seed city has no barn, so its mill carries the row
  const state = seedGroundState(2);
  const barn = state.buildings.find((candidate) => candidate.kind === "farmstead") ?? state.buildings.find((candidate) => candidate.kind === "mill")!;
  const row = { buildingId: barn.id, kind: barn.kind, good: "wheat", amount: 932, days: 0, reason: "no_carrier", source: "field", store: null,
    tile: { tx: barn.tx, ty: barn.ty } } as const;

  // When
  const model = inspectorModel(state, barn.id, [row]);
  const markup = renderToStaticMarkup(createElement(Inspector, { state, buildingId: barn.id, onClose: () => undefined, stuck: [row] }));

  // Then
  assert.ok(model?.why.some((line) => line.block && line.text === "밀 932 묶임 — 운반꾼 부족 · 수확 버려짐"));
  assert.deepEqual(model?.actions, ["이 건물 가까이에 곡창을 지어 수레 길을 줄이세요", "방앗간을 가까이 지으면 방앗간 수레가 밀을 가져갑니다"]);
  assert.ok(!markup.includes("지금 할 일이 없습니다"));
  // Another building's pile changes nothing here; without rows the inspector is as before.
  assert.deepEqual(inspectorModel(state, barn.id, [{ ...row, buildingId: "elsewhere" }]), inspectorModel(state, barn.id));
});

test("UI-AUDIT-1: the stuck reasons read as actions with the store's particle (곡창과 · 창고를)", () => {
  const state = seedGroundState(2);
  const barn = state.buildings.find((candidate) => candidate.kind === "farmstead") ?? state.buildings.find((candidate) => candidate.kind === "mill")!;
  const base = { buildingId: barn.id, kind: barn.kind, amount: 800, days: 0, source: "stock", tile: { tx: barn.tx, ty: barn.ty } } as const;
  const granary = { id: "granary-x", kind: "granary", used: 200, capacity: 200 } as const;
  const first = (good: "wheat" | "fleece", reason: "no_road" | "receiver_full" | "no_carrier", store: typeof granary | null = null) =>
    inspectorModel(state, barn.id, [{ ...base, good, reason, store }])?.actions[0];
  assert.equal(first("wheat", "no_road"), "곡창과 이 건물을 도로로 이어 주세요");
  // LM-R1: the engine's receiver_full with no such store at all builds one; with full stores, another.
  assert.equal(first("fleece", "receiver_full"), "창고를 지으세요");
  assert.equal(first("wheat", "receiver_full", granary), "곡창을 하나 더 지으세요");
  assert.equal(first("fleece", "no_carrier"), "이 건물 가까이에 창고를 지어 수레 길을 줄이세요");
});

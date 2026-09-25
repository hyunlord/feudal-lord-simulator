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
  assert.match(markup, /<button type="button" class="left-inspector-close" aria-label="닫기">/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import type { InputIntent } from "../src/input/inputIntent";
import { platformServices } from "../src/platform/platform";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { AlertStack, inspectAlertRow } from "../src/ui/AlertStackView";
import { ALERT_STACK_MAX_ROWS, ALERT_STACK_MIN_TICK, alertRowLookAtIntent, alertStackRows } from "../src/ui/alertStackModel";
import { seedGroundState } from "../scripts/boundaryFixtureStates";
import { building, state as makeState } from "./stoneWallConversionFixtures";

function runTicks(state: GameState, ticks: number): GameState {
  let next = state;
  for (let index = 0; index < ticks; index += 1) next = advanceTick(next);
  return next;
}

const FRESH_AFTER_START = runTicks(DEFAULT_GAME_STATE, 25);

/** Seed 2 (developed city) with its wheat gone and every other well removed: 10 blocked mills, some houses at risk. */
function troubledCity(): GameState {
  const city = seedGroundState(2);
  let wells = 0;
  return {
    ...city,
    tick: 1_000,
    buildings: city.buildings
      .filter((candidate) => candidate.kind !== "well" || (wells += 1) % 2 === 1)
      .map((candidate) => ({ ...candidate, inventory: { ...candidate.inventory, wheat: 0 } })),
  };
}

test("a new game shows no warnings, before or after the first supply ticks", () => {
  // Given / When / Then: tick 0 (supply not computed) and tick 25 (the opening village is fine).
  assert.deepEqual(alertStackRows(DEFAULT_GAME_STATE), []);
  assert.deepEqual(alertStackRows(FRESH_AFTER_START), []);
});

test("nothing is shown while the game has not run yet, even with a real problem", () => {
  // Given: the opening village without its well.
  const noWell = { ...FRESH_AFTER_START, buildings: FRESH_AFTER_START.buildings.filter((candidate) => candidate.kind !== "well") };

  // When / Then
  assert.deepEqual(alertStackRows({ ...noWell, tick: ALERT_STACK_MIN_TICK - 1 }), []);
  const rows = alertStackRows({ ...noWell, tick: ALERT_STACK_MIN_TICK });
  assert.equal(rows.length, 1);
  assert.deepEqual(
    { severity: rows[0]?.severity, shape: rows[0]?.shape, title: rows[0]?.title, countLabel: rows[0]?.countLabel, cause: rows[0]?.cause },
    { severity: "caution", shape: "◆", title: "물 부족", countLabel: "주택 4", cause: "우물이 없습니다" },
  );
  assert.deepEqual(rows[0]?.targetIds, ["house-44-40-0", "house-46-40-0", "house-44-42-0", "house-46-42-0"]);
});

test("the same cause folds across buildings; immediate rows come first, then by count", () => {
  // Given
  const rows = alertStackRows(troubledCity());

  // Then: all ten mills share one row with the example wording.
  const mills = rows.find((row) => row.title === "밀 공급 없음");
  assert.ok(mills !== undefined, JSON.stringify(rows));
  assert.equal(mills.shape, "▲");
  assert.equal(mills.countLabel, "방앗간 10");
  assert.equal(mills.cause, "곡창에 밀 재고가 없습니다");
  assert.equal(mills.targetIds.length, 10);
  // Houses too far from the remaining wells fold into one row although their distances differ.
  const water = rows.find((row) => row.title === "물 부족");
  assert.ok(water !== undefined);
  assert.match(water.cause, /^우물이 너무 멉니다 — 거리 \d+ \/ 범위 \d+$/);
  assert.ok(water.count > 1);
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1]!, current = rows[index]!;
    const rank = (row: typeof current) => (row.severity === "immediate" ? 0 : 1);
    assert.ok(rank(previous) < rank(current) || (rank(previous) === rank(current) && previous.count >= current.count));
  }
});

test("at most three rows: the smallest group is dropped", () => {
  // Given: four distinct immediate causes — mills without wheat (10), houses at risk far from a well (several),
  // a paused sawmill and masonry (one row of mixed kinds, 3) and one overflowing storehouse (1).
  const city = troubledCity();
  let overflowing = false;
  const crowded = { ...city, buildings: city.buildings.map((candidate) => {
    if (candidate.kind === "sawmill" || candidate.kind === "masonry") return { ...candidate, operationPaused: true };
    if (candidate.kind === "storehouse" && !overflowing) {
      overflowing = true;
      return { ...candidate, inventory: { ...candidate.inventory, timber: 10_000 } };
    }
    return candidate;
  }) };

  // When
  const rows = alertStackRows(crowded);

  // Then
  assert.equal(rows.length, ALERT_STACK_MAX_ROWS);
  assert.ok(rows.every((row) => row.severity === "immediate"));
  assert.deepEqual(rows.map((row) => row.count), [...rows.map((row) => row.count)].sort((a, b) => b - a));
  assert.ok(rows.some((row) => row.countLabel === "건물 3" && row.title === "가동 중지"), JSON.stringify(rows.map((row) => row.countLabel)));
  assert.ok(!rows.some((row) => row.title === "창고 넘침"));
  assert.equal(alertStackRows({ ...crowded, buildings: crowded.buildings.filter((candidate) => candidate.kind !== "mill") })
    .some((row) => row.title === "창고 넘침"), true, "with the mills gone the overflow row fits");
});

test("a construction site off the road shows as an immediate site row", () => {
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
  const rows = alertStackRows(state);

  // Then
  assert.deepEqual(rows.map((row) => [row.shape, row.title, row.countLabel, row.cause, row.targetIds[0], row.focusTile]), [
    ["▲", "공사장 도로 미연결", "공사 1", "공사장까지 길이 이어지지 않았습니다", "well-plan", { tx: 5, ty: 5 }],
  ]);
});

test("rows are memoised per state object", () => {
  const state = troubledCity();
  assert.equal(alertStackRows(state), alertStackRows(state));
});

test("[보기] moves the camera to the first affected building, then inspects it", () => {
  // Given
  const row = alertStackRows(troubledCity())[0]!;
  const intents: InputIntent[] = [];
  const inspected: string[] = [];
  const unsubscribe = platformServices().input.subscribe((intent) => { intents.push(intent); return "handled"; });

  // When
  try {
    inspectAlertRow(row, (id) => inspected.push(id));
  } finally {
    unsubscribe();
  }

  // Then
  assert.deepEqual(intents, [alertRowLookAtIntent(row)]);
  assert.deepEqual(intents[0], { kind: "lookAt", tile: row.focusTile });
  assert.deepEqual(inspected, [row.targetIds[0]]);
});

test("the stack renders one row per cause with a bold title, count, cause and a 보기 button", () => {
  // Given / When
  const markup = renderToStaticMarkup(createElement(AlertStack, { state: troubledCity(), onInspect: () => undefined }));
  const empty = renderToStaticMarkup(createElement(AlertStack, { state: FRESH_AFTER_START, onInspect: () => undefined }));

  // Then
  assert.equal(empty, "");
  assert.match(markup, /aria-label="경고"/);
  assert.match(markup, /<strong>밀 공급 없음<\/strong> · <span>방앗간 10<\/span>/);
  assert.match(markup, /곡창에 밀 재고가 없습니다/);
  assert.equal(markup.match(/<button/g)?.length, alertStackRows(troubledCity()).length);
  assert.match(markup, />보기<\/button>/);
});

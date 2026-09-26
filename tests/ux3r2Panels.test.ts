import assert from "node:assert/strict";
import { test } from "node:test";

import { ARABLE_CONFIG } from "../src/content/arableConfig";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import type { Building } from "../src/content/buildingConfig";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { GRADE_BARRED, GRADE_FAIR, GRADE_GOOD, paintableLandGrades } from "../src/render/zonePaintableLand";
import { createStoreStockHistory, observeStoreStockHistory, WEEK_TICKS, weeklyTotalChange } from "../src/ui/storeStockHistory";
import { storeInspectorModel } from "../src/ui/storeInspectorModel";
import { constructionBlockerLine } from "../src/ui/constructionBlockerLine";
import type { GameState } from "../src/engine/engine.types";

const state = DEFAULT_GAME_STATE;

test("UX-3R2 paintable land: water is barred for every kind; arable is good only within a road-connected barn's reach", () => {
  const water = state.tiles.findIndex(tile => tile.terrain === "water");
  assert.ok(water >= 0);
  for (const kind of ["arable", "burgage", "pasture", "orchard"] as const) assert.equal(paintableLandGrades(state, kind)[water], GRADE_BARRED, kind);
  const arable = paintableLandGrades(state, "arable");
  const reachable = (cell: number) => {
    const tx = cell % state.width; const ty = Math.floor(cell / state.width); const r = ARABLE_CONFIG.tendRadius;
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -(r - Math.abs(dy)); dx <= r - Math.abs(dy); dx += 1) {
      const x = tx + dx; const y = ty + dy;
      if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue;
      if (buildingRoadAccessTiles(state, { id: "t", kind: "farmstead", tx: x, ty: y } as Building).length > 0) return true;
    }
    return false;
  };
  const sample = Array.from({ length: state.width * state.height }, (_, cell) => cell).filter((cell, index) => index % 97 === 0 && arable[cell] !== GRADE_BARRED);
  for (const cell of sample) assert.equal(arable[cell], reachable(cell) ? GRADE_GOOD : GRADE_FAIR, `cell ${cell}`);
  assert.ok(sample.some(cell => arable[cell] === GRADE_GOOD) && sample.some(cell => arable[cell] === GRADE_FAIR), "both grades occur on the new map");
  const pasture = paintableLandGrades(state, "pasture");
  assert.ok(pasture.every(grade => grade !== GRADE_FAIR), "no rule, no fair grade");
});

test("UX-3R2 store history: the weekly change needs a week of samples, then is now minus a week ago", () => {
  let history = createStoreStockHistory();
  const granary = state.buildings.find(building => building.kind === "granary")!;
  const at = (tick: number, bread: number): GameState => ({ ...state, tick, buildings: state.buildings.map(building => building === granary ? { ...building, inventory: { bread } } : building) });
  history = observeStoreStockHistory(history, at(0, 30));
  assert.equal(weeklyTotalChange(history, "bread", at(10, 28)), null);
  for (let tick = 1; tick <= WEEK_TICKS + 2; tick += 1) history = observeStoreStockHistory(history, at(tick, 30 - Math.floor(tick / 10)));
  const now = at(WEEK_TICKS + 2, 30 - Math.floor((WEEK_TICKS + 2) / 10));
  const change = weeklyTotalChange(history, "bread", now);
  assert.ok(change !== null && change < 0, `bread fell: ${change}`);
  const model = storeInspectorModel(now, granary.id, history)!;
  assert.deepEqual(model.items.map(item => item.resource), ["wheat", "bread"], "a granary takes wheat and bread by rule");
  assert.equal(model.capacity, 200);
  assert.ok(model.items.find(item => item.resource === "bread")!.week.startsWith("−"));
  const restarted = observeStoreStockHistory(history, at(3, 30));
  assert.equal(restarted.samples.length, 1, "the clock going back (a load) starts the history over");
});

test("UX-3R2 site first line: what it waits for, the nearest stock and the carts on the way", () => {
  const storehouse = state.buildings.find(building => building.kind === "storehouse");
  const site = { id: "s1", kind: "house" as const, tx: 50, ty: 50, required: { timber: 10 }, delivered: { timber: 2 }, reserved: { timber: 4 },
    builderTicks: 0, requiredBuilderTicks: 100, assignedBuilders: 0, stall: "awaiting_materials" as const, startedTick: 0 };
  const line = constructionBlockerLine({ ...state, buildings: storehouse === undefined ? state.buildings : state.buildings.map(b => b === storehouse ? { ...b, inventory: { timber: 5 } } : b) }, site);
  assert.ok(line !== null && line.startsWith("목재 4 대기 — "), String(line));
  assert.ok(line!.endsWith("운반꾼 0"));
  assert.equal(constructionBlockerLine(state, { ...site, stall: "no_builders" }), null, "only while it waits for materials");
});

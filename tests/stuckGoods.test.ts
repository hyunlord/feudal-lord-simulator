import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Walker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import type { InputIntent } from "../src/input/inputIntent";
import { platformServices } from "../src/platform/platform";
import { pressStuckGoods, StuckGoodsChip, stuckGoodsChipView } from "../src/ui/hud/StuckGoodsChip";
import { STUCK_GOODS_COPY } from "../src/ui/stuckGoodsCopy.ko";
import {
  compassFromCentre, EMPTY_STUCK_MEMORY, observeStuckGoods, STUCK_MIN_TICK, STUCK_STILL_TICKS, stuckGoods, stuckGoodsLookAtIntent,
} from "../src/ui/stuckGoodsModel";

// UI-AUDIT-1: stock piled in one building that cannot leave, from bare states: a barn at (1,1) whose road runs along
// y = 2 to a granary at (9,0) (2x2, its access at (9,2) and (10,2)).

const W = 14;
const H = 8;

function building(id: string, kind: Building["kind"], tx: number, ty: number, inventory: Building["inventory"] = {}): Building {
  return { id, kind, tx, ty, workers: 0, inventory, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

function world(buildings: readonly Building[], roads: (tx: number, ty: number) => boolean, patch: Partial<GameState> = {}): GameState {
  const owner = (tx: number, ty: number) => buildings.find(b => tx >= b.tx && ty >= b.ty
    && tx < b.tx + (b.kind === "granary" || b.kind === "keep" ? 2 : 1) && ty < b.ty + (b.kind === "granary" || b.kind === "keep" ? 2 : 1))?.id ?? null;
  const tiles = Array.from({ length: W * H }, (_unused, index) => {
    const tx = index % W, ty = Math.floor(index / W);
    return { tx, ty, terrain: "grass" as const, buildingId: owner(tx, ty), hasRoad: owner(tx, ty) === null && roads(tx, ty) };
  });
  return {
    tick: 100, seed: 7, width: W, height: H, tiles, buildings: [...buildings], houses: [], walkers: [], population: 0, idleWorkers: 0,
    treasuryTimber: 0, constructionSites: [], wallTick: 0, era: "hamlet", eraProclaimedTick: null, palisade: null,
    nextConstructionOrdinal: 1, roadRevision: 0, pathCache: {}, forestHarvests: [], treasuryCoin: 0, ...patch,
  };
}

const roadRow = (tx: number, ty: number) => ty === 2 && tx >= 1 && tx <= 10;
const barn = (wheat: number) => building("barn", "farmstead", 1, 1, { wheat });
const granary = (wheat = 0) => building("granary", "granary", 9, 0, { wheat });

test("a barn with wheat and no road to any granary is stuck: no_road", () => {
  const cut = world([barn(800), granary()], (tx, ty) => roadRow(tx, ty) && tx !== 5);
  assert.deepEqual(stuckGoods(cut).map(row => [row.buildingId, row.good, row.amount, row.reason, row.since]), [["barn", "wheat", 800, "no_road", null]]);
  const noAccess = world([barn(800), granary()], (tx, ty) => roadRow(tx, ty) && tx !== 1);
  assert.equal(stuckGoods(noAccess)[0]?.reason, "no_road");
});

test("every connected granary full (its wheat room is half its store) is receiver_full", () => {
  const full = world([barn(800), granary(100)], roadRow);
  assert.equal(stuckGoods(full)[0]?.reason, "receiver_full");
  // A mill on the same road still draws wheat from the barn (AF-9): not structurally stuck.
  const withMill = world([barn(800), granary(100), building("mill", "mill", 6, 3)], (tx, ty) => roadRow(tx, ty) || (tx === 6 && ty === 4));
  assert.deepEqual(stuckGoods(withMill), []);
});

test("no granary or mill at all is no_receiver", () => {
  assert.equal(stuckGoods(world([barn(800)], roadRow))[0]?.reason, "no_receiver");
});

test("a normal harvest — a barn filling with a road to a granary with room — is not stuck", () => {
  const harvest = world([barn(800), granary()], roadRow);
  assert.deepEqual(stuckGoods(harvest), []);
  // Under the pile threshold nothing is looked at, even with no road.
  assert.deepEqual(stuckGoods(world([barn(399), granary()], () => false)), []);
  // Before the supply is computed nothing shows.
  assert.deepEqual(stuckGoods(world([barn(800), granary()], () => false, { tick: STUCK_MIN_TICK - 1 })), []);
});

test("with the session memory, a pile that has not gone down in STUCK_STILL_TICKS is stuck (no carter out: no_carrier)", () => {
  const first = world([barn(800), granary()], roadRow);
  let memory = observeStuckGoods(first, EMPTY_STUCK_MEMORY);
  assert.deepEqual(stuckGoods(first, memory), []);
  const later = { ...first, tick: first.tick + STUCK_STILL_TICKS };
  memory = observeStuckGoods(later, memory);
  const rows = stuckGoods(later, memory);
  assert.deepEqual(rows.map(row => [row.reason, row.since, row.carriers]), [["no_carrier", first.tick, 0]]);

  // A carter seen out in the window but the pile still not going down: unknown.
  const carter = { id: "c1", kind: "carter", homeBuildingId: "barn" } as unknown as Walker;
  const withCarter = { ...first, tick: first.tick + 60, walkers: [carter] };
  let seen = observeStuckGoods(withCarter, observeStuckGoods(first, EMPTY_STUCK_MEMORY));
  const after = { ...first, tick: first.tick + STUCK_STILL_TICKS };
  seen = observeStuckGoods(after, seen);
  assert.equal(stuckGoods(after, seen)[0]?.reason, "unknown");

  // The pile going down resets the still window.
  const drained = { ...first, tick: first.tick + 200, buildings: [barn(700), granary()] };
  let moving = observeStuckGoods(drained, observeStuckGoods(first, EMPTY_STUCK_MEMORY));
  const end = { ...drained, tick: first.tick + STUCK_STILL_TICKS };
  moving = observeStuckGoods(end, moving);
  assert.deepEqual(stuckGoods(end, moving), []);
});

test("the memory starts again on an earlier tick or another game", () => {
  const first = world([barn(800), granary()], roadRow, { tick: 1000 });
  const memory = observeStuckGoods(first, EMPTY_STUCK_MEMORY);
  assert.equal(observeStuckGoods({ ...first, tick: 1200 }, memory).piles.get("barn|wheat")?.since, 1000);
  assert.equal(observeStuckGoods({ ...first, tick: 500 }, memory).piles.get("barn|wheat")?.since, 500);
  assert.equal(observeStuckGoods({ ...first, tick: 1200, seed: 8 }, memory).piles.get("barn|wheat")?.since, 1200);
});

test("the largest pile comes first; a fleece yard counts from 40 % of its room", () => {
  const second = building("barn2", "farmstead", 3, 1, { wheat: 500 });
  const fold = building("fold", "pastoral_farm", 12, 5, { fleece: 160 });
  const rows = stuckGoods(world([barn(800), second, fold], () => false));
  assert.deepEqual(rows.map(row => [row.buildingId, row.good, row.amount, row.reason]),
    [["barn", "wheat", 800, "no_road"], ["barn2", "wheat", 500, "no_road"], ["fold", "fleece", 160, "no_road"]]);
});

test("the direction follows the screen from the keep", () => {
  const keep = building("keep", "keep", 7, 3);
  const state = world([keep], () => false);
  // The keep's footprint centre is (7,3); screen up is -tx -ty, screen right is +tx -ty.
  assert.equal(compassFromCentre(state, { tx: 1, ty: -3 }), "north");
  assert.equal(compassFromCentre(state, { tx: 13, ty: 9 }), "south");
  assert.equal(compassFromCentre(state, { tx: 13, ty: -3 }), "east");
  assert.equal(compassFromCentre(state, { tx: 13, ty: 3 }), "southEast");
  assert.equal(compassFromCentre(state, { tx: 8, ty: 4 }), "centre");
});

test("the chip copy: the worst pile in one line, its reason, and how many more", () => {
  const keep = building("keep", "keep", 6, 6);
  const state = world([barn(800), building("barn2", "farmstead", 3, 1, { wheat: 500 }), granary(), keep], (tx, ty) => roadRow(tx, ty) && tx !== 5);
  const view = stuckGoodsChipView(state, stuckGoods(state));
  assert.ok(view !== null);
  assert.equal(view.line, "북쪽 헛간에 밀 800 묶임");
  assert.equal(view.reason, "길 없음");
  assert.equal(view.more, "외 1곳");
  assert.equal(view.label, "북쪽 헛간에 밀 800 묶임 — 길 없음. 누르면 그 건물로 갑니다");
  assert.equal(STUCK_GOODS_COPY.reason.receiver_full("곡창"), "곡창 가득");
  assert.equal(STUCK_GOODS_COPY.line("남쪽", "헛간", "밀", 1200), "남쪽 헛간에 밀 1,200 묶임");
  assert.equal(stuckGoodsChipView(state, []), null);

  const markup = renderToStaticMarkup(createElement(StuckGoodsChip, { view, onInspect: () => undefined }));
  assert.match(markup, /^<button type="button" class="stuck-goods-chip ui-btn ui-btn--secondary"/);
  assert.match(markup, /aria-label="북쪽 헛간에 밀 800 묶임 — 길 없음\. 누르면 그 건물로 갑니다"/);
  assert.match(markup, /외 1곳/);
  assert.doesNotMatch(markup, /title=/);
});

test("a press moves the camera to the building, then inspects it", () => {
  const state = world([barn(800), granary()], () => false);
  const row = stuckGoods(state)[0]!;
  const intents: InputIntent[] = [];
  const inspected: string[] = [];
  const unsubscribe = platformServices().input.subscribe((intent) => { intents.push(intent); return "handled"; });
  try {
    pressStuckGoods(row, id => inspected.push(id));
  } finally {
    unsubscribe();
  }
  assert.deepEqual(intents, [stuckGoodsLookAtIntent(row)]);
  assert.deepEqual(intents[0], { kind: "lookAt", tile: { tx: 1, ty: 1 } });
  assert.deepEqual(inspected, ["barn"]);
});

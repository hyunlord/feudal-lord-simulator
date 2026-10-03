import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import type { InputIntent } from "../src/input/inputIntent";
import { platformServices } from "../src/platform/platform";
import { pressStuckGoods, StuckGoodsChip, stuckGoodsChipView } from "../src/ui/hud/StuckGoodsChip";
import { stuckRows } from "../src/ui/hud/stuckStockView";
import { inspectorModel } from "../src/ui/inspectorModel";
import { STUCK_GOODS_COPY } from "../src/ui/stuckGoodsCopy.ko";
import { compassFromCentre, stuckGoodsLookAtIntent } from "../src/ui/stuckGoodsModel";

// UI-AUDIT-1 / LM-R1: stock piled in one building that cannot leave — the engine's list (FIX-11 `stuckStock`) as the HUD
// shows it — from bare states: a barn at (1,1) whose road runs along y = 2 to a granary at (9,0) (2x2, its access at
// (9,2) and (10,2)).

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

test("LM-R1: the HUD's piles are the engine's — a barn with no road is no_road, a full granary receiver_full with its fullness", () => {
  const cut = world([barn(800), granary()], () => false);
  assert.deepEqual(stuckRows(cut).map(row => [row.buildingId, row.good, row.amount, row.reason, row.store]), [["barn", "wheat", 800, "no_road", null]]);
  const full = world([barn(800), granary(200)], roadRow);
  const row = stuckRows(full)[0];
  assert.equal(row?.reason, "receiver_full");
  assert.deepEqual(row?.store, { id: "granary", kind: "granary", used: 200, capacity: 200 });
  // A normal harvest — a road, its hands and a granary with room, under four fifths of the barn — is not stuck; the same
  // barn short of hands or piled past four fifths is the engine's no_carrier.
  assert.deepEqual(stuckRows(world([{ ...barn(400), workers: 4 }, granary()], roadRow)), []);
  assert.equal(stuckRows(world([barn(400), granary()], roadRow))[0]?.reason, "no_carrier");
  assert.equal(stuckRows(world([{ ...barn(800), workers: 4 }, granary()], roadRow))[0]?.reason, "no_carrier");
});

test("LM-R1: a sawmill whose every storehouse is full names the nearest one (창고 200/200) and the inspector jumps there", () => {
  const sawmill = building("saw", "sawmill", 1, 1, { timber: 12 });
  const near = building("near", "storehouse", 5, 0, { timber: 200 });
  const far = building("far", "storehouse", 11, 4, { logs: 200 });
  const state = world([sawmill, near, far], roadRow);
  const rows = stuckRows(state);
  assert.deepEqual(rows.map(entry => [entry.buildingId, entry.good, entry.reason, entry.store?.id]), [["saw", "timber", "receiver_full", "near"]]);
  const view = stuckGoodsChipView(state, rows);
  assert.equal(view?.reason, "받을 곳 가득 · 창고 200/200");
  const model = inspectorModel(state, "saw", rows);
  assert.ok(model?.why.some(line => line.block && line.text === "목재 12 묶임 — 받을 곳 가득 · 창고 200/200"));
  assert.deepEqual(model?.toStore, { storeId: "near", label: "창고 보기", ariaLabel: "창고 200/200 — 누르면 그 건물로 갑니다" });
  // With no storehouse at all the engine still says receiver_full; there is no store to go to, and the action builds one.
  const alone = world([sawmill], roadRow);
  const lone = stuckRows(alone);
  assert.deepEqual(lone.map(entry => [entry.reason, entry.store]), [["receiver_full", null]]);
  assert.equal(inspectorModel(alone, "saw", lone)?.toStore, undefined);
  assert.equal(inspectorModel(alone, "saw", lone)?.actions[0], "창고를 지으세요");
});

test("the largest pile comes first", () => {
  const second = building("barn2", "farmstead", 3, 1, { wheat: 500 });
  const rows = stuckRows(world([barn(800), second], () => false));
  assert.deepEqual(rows.map(row => [row.buildingId, row.amount, row.reason]), [["barn", 800, "no_road"], ["barn2", 500, "no_road"]]);
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
  const state = world([barn(800), building("barn2", "farmstead", 3, 1, { wheat: 500 }), granary(), keep], () => false);
  const view = stuckGoodsChipView(state, stuckRows(state));
  assert.ok(view !== null);
  assert.equal(view.line, "북쪽 헛간에 밀 800 묶임");
  assert.equal(view.reason, "길 없음");
  assert.equal(view.more, "외 1곳");
  assert.equal(view.label, "북쪽 헛간에 밀 800 묶임 — 길 없음. 누르면 그 건물로 갑니다");
  assert.equal(STUCK_GOODS_COPY.reason.receiver_full, "받을 곳 가득");
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
  const row = stuckRows(state)[0]!;
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

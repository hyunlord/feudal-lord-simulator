/**
 * NAT-1: door prop variation rules for spinning houses (src/render/doorProps.ts).
 *
 * Three rules verified on real town states (reorg.textile_street.json, rumour-quiet.json,
 * c7-finished.json — JSON.parse of the file is a current-schema GameState):
 *
 *   A. Same prop at most on two consecutive spinning houses in a street row.
 *   B. At least 50 % of spinning houses show nothing.
 *   C. Any single prop key ≤ 25 % of all spinning-house door prop slots.
 *
 * Plus: determinism and backyard-skip.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { spinningSlot } from "../src/engine/cloth";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { backyardPlan } from "../src/render/backyardDecals";
import { spinDoorProp, spinDoorPropShares } from "../src/render/doorProps";

const STATE_PATHS = [
  "/Users/rexxa/fls-ui9-states/reorg.textile_street.json",
  "/Users/rexxa/fls-ui9-states/rumour-quiet.json",
  "/Users/rexxa/fls-cloth-states/c7-finished.json",
];

function loadState(path: string): GameState {
  return JSON.parse(readFileSync(path, "utf8")) as GameState;
}

/** NAT-1: street row grouping — same formula as doorProps.ts */
function streetRows(state: GameState): Map<number, Array<{ id: string; prop: string | null }>> {
  const houseMap = new Map(state.houses.map(h => [h.buildingId, h]));
  const groups = new Map<number, Array<{ id: string; ty: number }>>() ;
  for (const building of state.buildings) {
    if (building.kind !== "house") continue;
    const house = houseMap.get(building.id);
    if (house === undefined || spinningSlot(house) === null) continue;
    const col = building.tx + buildingFootprint(building).width;
    let row = groups.get(col);
    if (row === undefined) { row = []; groups.set(col, row); }
    row.push({ id: building.id, ty: building.ty });
  }
  const result = new Map<number, Array<{ id: string; prop: string | null }>>();
  for (const [col, entries] of groups) {
    const sorted = [...entries].sort((a, b) => a.ty - b.ty);
    result.set(col, sorted.map(e => ({ id: e.id, prop: spinDoorProp(state, e.id) })));
  }
  return result;
}

test("NAT-1: spinning-house door props are deterministic (same result on a structuredClone)", () => {
  for (const path of STATE_PATHS) {
    const state = loadState(path);
    const copy = structuredClone(state) as GameState;
    for (const building of state.buildings) {
      if (building.kind !== "house") continue;
      const house = state.houses.find(h => h.buildingId === building.id);
      if (house === undefined || spinningSlot(house) === null) continue;
      assert.equal(
        spinDoorProp(copy, building.id),
        spinDoorProp(state, building.id),
        `${path}: ${building.id}`,
      );
    }
  }
});

test("NAT-1: at least 50 % of spinning houses show no door prop (rule B)", () => {
  for (const path of STATE_PATHS) {
    const state = loadState(path);
    const shares = spinDoorPropShares(state);
    const noneShare = shares.get("none") ?? 0;
    assert.ok(
      noneShare >= 0.5,
      `${path}: only ${(noneShare * 100).toFixed(1)} % empty (want ≥ 50 %)`,
    );
  }
});

test("NAT-1: no single prop key is more than 25 % of all spinning-house door slots (rule C)", () => {
  for (const path of STATE_PATHS) {
    const state = loadState(path);
    const shares = spinDoorPropShares(state);
    for (const [key, share] of shares) {
      if (key === "none") continue; // "none" is not a shown prop
      assert.ok(
        share <= 0.25,
        `${path}: prop "${key}" is ${(share * 100).toFixed(1)} % (want ≤ 25 %)`,
      );
    }
  }
});

test("NAT-1: same prop never on 3 consecutive spinning houses in a street row (rule A)", () => {
  for (const path of STATE_PATHS) {
    const state = loadState(path);
    const rows = streetRows(state);
    for (const [col, row] of rows) {
      for (let i = 2; i < row.length; i += 1) {
        const p0 = row[i - 2]!.prop;
        const p1 = row[i - 1]!.prop;
        const p2 = row[i]!.prop;
        if (p0 !== null && p0 === p1 && p0 === p2) {
          assert.fail(
            `${path}: col=${col} positions ${i - 2}/${i - 1}/${i} all have "${p0}"`,
          );
        }
      }
    }
  }
});

test("NAT-1: houses with a Wave 27 weaver backyard get no door prop (rule C)", () => {
  for (const path of STATE_PATHS) {
    const state = loadState(path);
    const weaverIds = new Set(
      backyardPlan(state)
        .filter(decal => decal.key === "yard_weaver_a" || decal.key === "yard_weaver_b")
        .map(decal => decal.buildingId),
    );
    for (const id of weaverIds) {
      assert.equal(
        spinDoorProp(state, id),
        null,
        `${path}: house ${id} has weaver backyard but non-null door prop`,
      );
    }
  }
});

/**
 * NAT-1: door prop variation rules for spinning houses (src/render/doorProps.ts).
 *
 * Three rules verified on the chapter-four-town save with every house (and every other house) spinning:
 *
 *   A. Same prop at most on two consecutive spinning houses in a street row.
 *   B. At least 50 % of spinning houses show nothing.
 *   C. Any single prop key ≤ 25 % of all spinning-house door prop slots.
 *
 * Plus: determinism and backyard-skip.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { decodeSave } from "../src/save/saveCodec";
import { SPIN_YARN_CRAFT_ID } from "../src/engine/cloth";
import { test } from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { spinningSlot } from "../src/engine/cloth";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { backyardPlan } from "../src/render/backyardDecals";
import { spinDoorProp, spinDoorPropShares } from "../src/render/doorProps";

// The test towns: the repository's chapter-four-town save (its streets and houses), with every house spinning (the
// 1370s towns the rule was made for spin in 24 of their houses; this one's fixture has none), and the same town with
// every other house spinning.
const town = decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v${SAVE_SCHEMA_VERSION}/chapter-four-town.save.json`))).envelope.state as GameState;
const spinning = (every: number): GameState => ({ ...town, houses: town.houses.map((house, index) => index % every !== 0 ? house : {
  ...house, crafts: [house.crafts?.[0] ?? null, { craftId: SPIN_YARN_CRAFT_ID, workers: 1, input: { fleece: 1 }, output: { yarn: 1 }, stock: { fleece: 0 } }],
}) as GameState["houses"] });
const STATES: readonly GameState[] = [spinning(1), spinning(2)];

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
  for (const state of STATES) {
    const copy = structuredClone(state) as GameState;
    for (const building of state.buildings) {
      if (building.kind !== "house") continue;
      const house = state.houses.find(h => h.buildingId === building.id);
      if (house === undefined || spinningSlot(house) === null) continue;
      assert.equal(
        spinDoorProp(copy, building.id),
        spinDoorProp(state, building.id),
        `town ${STATES.indexOf(state)}: ${building.id}`,
      );
    }
  }
});

test("NAT-1: at least 50 % of spinning houses show no door prop (rule B)", () => {
  for (const state of STATES) {
    const shares = spinDoorPropShares(state);
    const noneShare = shares.get("none") ?? 0;
    assert.ok(
      noneShare >= 0.5,
      `town ${STATES.indexOf(state)}: only ${(noneShare * 100).toFixed(1)} % empty (want ≥ 50 %)`,
    );
  }
});

test("NAT-1: no single prop key is more than 25 % of all spinning-house door slots (rule C)", () => {
  for (const state of STATES) {
    const shares = spinDoorPropShares(state);
    for (const [key, share] of shares) {
      if (key === "none") continue; // "none" is not a shown prop
      assert.ok(
        share <= 0.25,
        `town ${STATES.indexOf(state)}: prop "${key}" is ${(share * 100).toFixed(1)} % (want ≤ 25 %)`,
      );
    }
  }
});

test("NAT-1: same prop never on 3 consecutive spinning houses in a street row (rule A)", () => {
  for (const state of STATES) {
    const rows = streetRows(state);
    for (const [col, row] of rows) {
      for (let i = 2; i < row.length; i += 1) {
        const p0 = row[i - 2]!.prop;
        const p1 = row[i - 1]!.prop;
        const p2 = row[i]!.prop;
        if (p0 !== null && p0 === p1 && p0 === p2) {
          assert.fail(
            `town ${STATES.indexOf(state)}: col=${col} positions ${i - 2}/${i - 1}/${i} all have "${p0}"`,
          );
        }
      }
    }
  }
});

test("NAT-1: houses with a Wave 27 weaver backyard get no door prop (rule C)", () => {
  for (const state of STATES) {
    const weaverIds = new Set(
      backyardPlan(state)
        .filter(decal => decal.key === "yard_weaver_a" || decal.key === "yard_weaver_b")
        .map(decal => decal.buildingId),
    );
    for (const id of weaverIds) {
      assert.equal(
        spinDoorProp(state, id),
        null,
        `town ${STATES.indexOf(state)}: house ${id} has weaver backyard but non-null door prop`,
      );
    }
  }
});

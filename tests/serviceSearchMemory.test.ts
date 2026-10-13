/**
 * GROW-A (the user's ruling 2026-10-13, P-X1): a lord town's failed second church or market search is remembered by the
 * layout and not run again until the layout changes — the same answer, the same work charged to the search budget, so
 * the steps after it decide as before. The state: seed 33 (lord slice) at 1324, 718 people, five houses out of the
 * church's reach and no site the service space accepts (engine-GROWA-prof-277bbcc).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { autoplaySearchWorkUsed, runAutoplaySearch } from "../src/engine/autoplaySearchBudget";
import { urbanServiceAction } from "../src/engine/autoplayServices";
import { resetAutoplayServiceSearch } from "../src/engine/autoplayServiceSpace";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";

const town = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/charter/seed33-1324-church-outside.save.json.gz")))).envelope.state as GameState;
const search = (state: GameState) => {
  resetAutoplayServiceSearch();
  let work = 0;
  const action = runAutoplaySearch(() => { const found = urbanServiceAction(state, undefined, () => true, "interior:24"); work = autoplaySearchWorkUsed() ?? 0; return found; });
  return { action, work };
};

test("a failed service search, remembered by the layout: the same answer and the same work charged, run again", () => {
  const first = search(town);
  assert.equal(first.action.kind, "none");
  assert.ok(first.work > 0, "the search spent work on the service space");
  const again = search(town);
  assert.deepEqual(again, first);
  // Another state object with the same layout (a tick's stocks moved) is the same search.
  const stocks = { ...town, buildings: town.buildings.map(building => ({ ...building, inventory: { ...building.inventory, wheat: (building.inventory.wheat ?? 0) + 1 } })) };
  assert.deepEqual(search(stocks), first);
});

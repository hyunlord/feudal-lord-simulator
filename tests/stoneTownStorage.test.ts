/**
 * STORE (the user's ruling 2026-10-20, lord mode): a stone town's plan ends with the storage step, on the palisade era's
 * rule (`storageAction`). The state: seed 32 (lord slice) at the first tick of 1326, from the trunk c0e0ac78 (DGX
 * engine-STORE-save32-c0e0ac7) — a stone town since 1319, its four storehouses nearly full, no storage need raised
 * (DGX engine-STORE-diag-e7a0f01).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { planningNeeds } from "../src/engine/autoplay";
import type { GameState } from "../src/engine/engine.types";
import { LORD_MODE_POLICY, townProposals } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";

const town = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/store/seed32-1326.save.json.gz")))).envelope.state as GameState;
const held = (state: GameState) => state.buildings.filter(b => b.kind === "storehouse").reduce((sum, b) => sum + Object.values(b.inventory).reduce((s, v) => s + (v ?? 0), 0), 0);

test("STORE: the lord's stone town with its storehouses nearly full raises the storage need, and the town proposes a storehouse", () => {
  assert.equal(town.era, "stone_town");
  const stores = town.buildings.filter(b => b.kind === "storehouse").length;
  assert.ok(held(town) > stores * 200 - 80, `${held(town)} held in ${stores} storehouses`);
  const storage = planningNeeds(town, LORD_MODE_POLICY).filter(need => need.planner === "storage");
  assert.equal(storage.length, 1);
  assert.ok(townProposals(town).some(proposal => proposal.what === "storehouse"), "a storehouse among the town's proposals");
});

test("STORE: the sandbox bot's stone town keeps its list — no storage step", () => {
  const { agency: _agency, ...sandbox } = town;
  assert.equal(planningNeeds(sandbox as GameState, LORD_MODE_POLICY).filter(need => need.planner === "storage").length, 0);
});

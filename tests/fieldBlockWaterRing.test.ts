/**
 * FIELD-OUT (the user's ruling 2026-10-23, lord mode): a town by its river whose every field block near a farmstead or a
 * road fails the setback on the water takes such a block — only once no block keeps the old setback. LOT-FIX's
 * "room for a field outside the wall" asks the grain step's own search, so it answers with the setback, the farmsteads'
 * reach and the roads.
 *  - Seed 26 under FOOD-P-RE at the first tick of 1317 (DGX engine-LOTGAP-saves-7ea2cb8, branch claude/food-p-re
 *    `7ea2cb82`; its rows equal the judgement run engine-FOODPRE-after-7ea2cb8): wheat short (actual_wheat_deficit), the
 *    fields stopped at 141 cells; 858 open blocks outside the wall, the 11 near a farmstead with room, the one by a road
 *    and 23 of the road search's 24 fail on the water ring (docs/verification/field-out/REPORT.md).
 *  - Seed 39 under FOOD-P-RE at the first tick of 1319: a block keeps the old setback, so the water ring is not used.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { fieldBlockAction, outsideFieldBlockExists } from "../src/engine/autoplayArable";
import { hasAutoplayBuildingClearance, hasAutoplayFieldWaterRingClearance } from "../src/engine/autoplaySetback";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";

const load = (path: string) => decodeSave(new Uint8Array(gunzipSync(readFileSync(path)))).envelope.state as GameState;
const seed26 = load("fixtures/lots/seed26-1317-foodpre.save.json.gz");
const seed39 = load("fixtures/lots/seed39-1319-foodpre.save.json.gz");
const sandboxOf = (state: GameState): GameState => { const { agency: _agency, ...sandbox } = state; return sandbox as GameState; };
const anchorOf = (state: GameState) => {
  const action = fieldBlockAction(state, true);
  assert.equal(action.kind, "paint_zone");
  const point = action.kind === "paint_zone" ? action.stroke.tool === "polygon" ? action.stroke.points[0] : undefined : undefined;
  assert.ok(point !== undefined);
  return { tx: point.x, ty: point.y };
};

test("FIELD-OUT: by the river with no block keeping the setback, the grain step takes a block that fails only on the water", () => {
  const anchor = anchorOf(seed26);
  assert.equal(hasAutoplayBuildingClearance(seed26, "wheat_farm", anchor), false, "the old setback refuses it");
  assert.equal(hasAutoplayFieldWaterRingClearance(seed26, anchor), true, "only the water ring");
  assert.deepEqual(fieldBlockAction(sandboxOf(seed26), true), { kind: "none" }, "the sandbox keeps the old setback");
});

test("FIELD-OUT: the old setback first — with a block that keeps it, the water ring is not used", () => {
  assert.equal(hasAutoplayBuildingClearance(seed39, "wheat_farm", anchorOf(seed39)), true);
});

test("FIELD-OUT: LOT-FIX's room for a field outside the wall is the grain step's own answer", () => {
  for (const state of [seed26, sandboxOf(seed26), seed39]) {
    assert.equal(outsideFieldBlockExists(state), fieldBlockAction(state, true).kind !== "none");
  }
  assert.equal(outsideFieldBlockExists(sandboxOf(seed26)), false, "858 open blocks, none the step could draw");
});

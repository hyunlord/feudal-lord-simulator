/**
 * LOT-FIX (the user's ruling 2026-10-22, lord mode): a walled town that still wants lots and has no free house site
 * inside its wall gives one enclosed field cell back as a house site.
 *  - Seed 33, the trunk's natural save at the first tick of 1312 (trunk 349da108, DGX engine-LOTFIX-save33): its wall
 *    closed in 1311, one lot still wanted, no free interior house site — every site beside a road lies under the fields
 *    the charter's ring took in. A natural trunk state (not made), the defect's own shape (JUDGE-POP-2).
 *  - Seed 26 under FOOD-P2 at the first tick of 1313 (DGX engine-LOT-save26, branch claude/food-p `badac67f`): the same
 *    shape with three lots wanted — the town stopped at 21 houses there.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { planningNeeds } from "../src/engine/autoplay";
import { interiorHouseSites } from "../src/engine/autoplayInteriorPlots";
import { enclosedFieldLot, releaseEnclosedFieldLot } from "../src/engine/enclosedFieldLots";
import type { GameState } from "../src/engine/engine.types";
import { LORD_MODE_POLICY } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";
import { zonesOf } from "../src/zones/zoneEdits";

const load = (path: string) => decodeSave(new Uint8Array(gunzipSync(readFileSync(path)))).envelope.state as GameState;
const trunk33 = load("fixtures/lots/seed33-1312.save.json.gz");
const foodP2Seed26 = load("fixtures/lots/seed26-1313-foodp2.save.json.gz");

const zoned = (state: GameState) => new Set(zonesOf(state).flatMap(zone => zone.membership));
const arable = (state: GameState) => zonesOf(state).filter(zone => zone.kind === "arable").reduce((sum, zone) => sum + zone.membership.length, 0);
/** Interior house sites the housing step could take: grass, beside a road, under no zone. */
const freeSites = (state: GameState) => {
  const cells = zoned(state);
  return interiorHouseSites(state).filter(site => state.tiles[site.ty * state.width + site.tx]?.terrain === "grass"
    && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => state.tiles[(site.ty + dy!) * state.width + site.tx + dx!]?.hasRoad === true)
    && !cells.has(site.ty * state.width + site.tx));
};

test("LOT-FIX: at a season's close one enclosed field cell goes back to the town as a free house site", () => {
  assert.equal(trunk33.tick % 1_000, 0);
  const released = releaseEnclosedFieldLot(trunk33);
  assert.equal(freeSites(released).length, 1);
  assert.equal(arable(released), arable(trunk33) - 1, "one field cell, no more");
  assert.equal(releaseEnclosedFieldLot(released), released, "with a free site again, nothing more this season");
});

test("LOT-FIX (FOOD-P2 seed 26 1313): the freed cell is where the housing step then plans its house", () => {
  assert.deepEqual(planningNeeds(foodP2Seed26, LORD_MODE_POLICY).filter(need => need.planner === "housing"), []);
  const cell = enclosedFieldLot(foodP2Seed26)!;
  const plans = planningNeeds(releaseEnclosedFieldLot(foodP2Seed26), LORD_MODE_POLICY).filter(need => need.planner === "housing").map(need => need.action);
  assert.deepEqual(plans, [{ kind: "place_building", building: "house", tx: cell.tx, ty: cell.ty }]);
});

test("LOT-FIX: nothing mid-season, nothing in the sandbox", () => {
  const midSeason = { ...trunk33, tick: trunk33.tick + 1 };
  assert.equal(releaseEnclosedFieldLot(midSeason), midSeason);
  const { agency: _agency, ...sandbox } = trunk33;
  assert.equal(enclosedFieldLot(sandbox as GameState), null);
  assert.equal(releaseEnclosedFieldLot(sandbox as GameState), sandbox);
});

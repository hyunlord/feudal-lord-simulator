/**
 * LOT-FIX, the defect on the trunk (JUDGE-POP-2): trunk code alone — this file passes on the trunk and shows the shape the
 * fix answers (`enclosedFieldLots.test.ts` fails on the trunk).
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

import { housingLotsStillNeeded, interiorHouseSites } from "../src/engine/autoplayInteriorPlots";
import type { GameState } from "../src/engine/engine.types";
import { LORD_MODE_POLICY } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";
import { zonesOf } from "../src/zones/zoneEdits";

const load = (path: string) => decodeSave(new Uint8Array(gunzipSync(readFileSync(path)))).envelope.state as GameState;
const trunk33 = load("fixtures/lots/seed33-1312.save.json.gz");

const zoned = (state: GameState) => new Set(zonesOf(state).flatMap(zone => zone.membership));
/** Interior house sites the housing step could take: grass, beside a road, under no zone. */
const freeSites = (state: GameState) => {
  const cells = zoned(state);
  return interiorHouseSites(state).filter(site => state.tiles[site.ty * state.width + site.tx]?.terrain === "grass"
    && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => state.tiles[(site.ty + dy!) * state.width + site.tx + dx!]?.hasRoad === true)
    && !cells.has(site.ty * state.width + site.tx));
};

test("LOT-FIX defect (trunk natural save, seed 33 1312): the wall closed, a lot still wanted, no interior house site left free, and the sites beside a road under the fields", () => {
  assert.notEqual(trunk33.palisade?.closedTick, undefined);
  assert.equal(housingLotsStillNeeded(trunk33, LORD_MODE_POLICY.maxHousingLots), 1);
  assert.equal(freeSites(trunk33).length, 0, "the housing step has no site to take");
  const fields = new Set(zonesOf(trunk33).filter(zone => zone.kind === "arable").flatMap(zone => zone.membership));
  const underFields = interiorHouseSites(trunk33).filter(site => fields.has(site.ty * trunk33.width + site.tx)
    && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => trunk33.tiles[(site.ty + dy!) * trunk33.width + site.tx + dx!]?.hasRoad === true));
  assert.ok(underFields.length > 0, "interior house sites beside a road lie under the fields");
});

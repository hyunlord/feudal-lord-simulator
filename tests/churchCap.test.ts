/**
 * CHURCH-CAP (the user's ruling 2026-10-21, (나), lord mode): one church past `ceil(lots / 32) + 1`, at most three, while
 * a house stands outside every church's reach, the town has not grown for more than two seasons and no church is being
 * built. The state: seed 25 (lord slice) at the first tick of 1321, from the trunk b9bd1f4b (DGX
 * engine-CAP-save25-b9bd1f4) — a stone town of 24 lots at 758, two churches, one house outside their reach, last grown
 * at tick 77,000 (seven seasons before).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { churchCap, urbanServiceAction, type ServicePlanningCollector } from "../src/engine/autoplayServices";
import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import { townProposals } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";

const town = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/church/seed25-1321.save.json.gz")))).envelope.state as GameState;
const outside = (state: GameState) => {
  const services = householdServices(state);
  return state.buildings.filter(home => home.kind === "house" && services.houses.get(home.id)?.church.kind === "outside").length;
};
const churchLimit = (state: GameState) => {
  const diagnostic: ServicePlanningCollector = {};
  const action = urbanServiceAction(state, diagnostic);
  return { action, limited: (diagnostic.services ?? []).some(entry => entry.service === "church" && entry.reason === "facility_limit") };
};

test("CHURCH-CAP: the lord's stalled town with a house outside both churches may build a third, and the town proposes it", () => {
  assert.equal(town.buildings.filter(b => b.kind === "church").length, 2);
  assert.equal(outside(town), 1);
  assert.ok(town.tick - (town.agency?.seasonGrowth?.lastGrowthTick ?? town.tick) > 2_000, "not grown for more than two seasons");
  assert.equal(churchCap(town, true), 3);
  const { action, limited } = churchLimit(town);
  assert.equal(limited, false);
  assert.deepEqual({ kind: action.kind, building: action.kind === "place_building" ? action.building : null }, { kind: "place_building", building: "church" });
  assert.ok(townProposals(town).some(proposal => proposal.what === "church"), "a church among the town's proposals");
});

test("CHURCH-CAP: a town that grew within two seasons keeps the old cap", () => {
  const grown = { ...town, agency: { ...town.agency!, seasonGrowth: { ...town.agency!.seasonGrowth!, lastGrowthTick: town.tick - 1_000 } } };
  assert.equal(churchCap(grown, true), 2);
  assert.equal(churchLimit(grown).limited, true);
});

test("CHURCH-CAP: the sandbox bot keeps the old cap", () => {
  const { agency: _agency, ...sandbox } = town;
  assert.equal(churchCap(sandbox as GameState, true), 2);
  assert.equal(churchLimit(sandbox as GameState).limited, true);
});

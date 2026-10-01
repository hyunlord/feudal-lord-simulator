/** QA033: a service's distance is given in its rule's own ruler — a market by road steps, the well and church by tiles. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import { MARKET_ROAD_REACH } from "../src/engine/marketService";
import { serviceMeasure } from "../src/engine/serviceMeasure";
import { decodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";

const town = decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v${SAVE_SCHEMA_VERSION}/chapter-two-town.save.json`))).envelope.state as GameState;

test("QA033 the market is measured in road steps against its 40-step reach; a served home is within it", () => {
  const allocation = householdServices(town);
  const homes = town.buildings.filter(building => building.kind === "house");
  let served = 0;
  for (const home of homes) {
    const measure = serviceMeasure(town, home, "market");
    assert.equal(measure.measure, "road_steps");
    assert.equal(measure.limit, MARKET_ROAD_REACH);
    if (allocation.houses.get(home.id)?.market?.kind === "served") {
      served += 1;
      assert.ok(measure.distance !== null && measure.distance <= MARKET_ROAD_REACH, `${home.id}: ${measure.distance}`);
      assert.equal(measure.providerId, allocation.houses.get(home.id)!.market!.providerId);
    }
  }
  assert.ok(served > 0, "the town's market serves homes");
});

test("QA033 the well and the church are measured in tiles against the building's service radius", () => {
  const home = town.buildings.find(building => building.kind === "house")!;
  for (const service of ["water", "church"] as const) {
    const measure = serviceMeasure(town, home, service);
    assert.equal(measure.measure, "tiles");
    assert.equal(measure.limit, BUILDING_CONFIG_BY_KIND[service === "water" ? "well" : "church"].serviceRadius);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { c25ZonedState } from "../scripts/c25Board";
import type { GameState } from "../src/engine/engine.types";
import { arableStripStateLookup } from "../src/render/drawArableFields";
import { farmProps } from "../src/render/farmProps";
import { farmsteadFieldWork, farmsteadImageUrl } from "../src/render/farmsteadArt";
import { zonesOf } from "../src/zones/zoneEdits";

// C1f farmstead art, field states and farm props, on the migrated real-input seed 2 scene (v9 -> v10, simulated
// without input: spring +800, harvest +2500) and the prepared five-state board (docs/verification/c1f-farmstead/scene).
const scene = (name: string): GameState => JSON.parse(gunzipSync(readFileSync(new URL(`../docs/verification/c1f-farmstead/scene/${name}.json.gz`, import.meta.url))).toString("utf8")) as GameState;

test("Given the spring and the harvest When the farmsteads are drawn Then they show their variant, and the working barn while a tended strip is ripe", () => {
  const spring = scene("arable-spring"); const harvest = scene("arable-harvest");
  const farmsteads = spring.buildings.filter(building => building.kind === "farmstead");
  assert.equal(farmsteads.length, 5);
  for (const farmstead of farmsteads) {
    assert.match(farmsteadImageUrl(spring, farmstead) ?? "", /farmstead_[ab]-v1\.png$/, `${farmstead.id} in spring`);
    const ripe = farmsteadFieldWork(harvest).get(farmstead.id)?.ripe === true;
    assert.equal(/farmstead_working-v1\.png$/.test(farmsteadImageUrl(harvest, farmstead) ?? ""), ripe, `${farmstead.id} at harvest`);
  }
  assert.ok([...farmsteadFieldWork(harvest).values()].some(work => work.ripe), "control: the harvest scene has a ripe strip");
});

test("Given the five-state board When the field states are read Then ploughed, seedling, growing, harvested and fallow all appear", () => {
  const states = new Set(arableStripStateLookup(scene("arable-five-states")).values());
  assert.deepEqual([...states].sort(), ["fallow", "growing", "harvested", "ploughed", "seedling"]);
});

test("Given the same state twice When farm props are placed Then they are identical, ox teams stand on their strips and animals in pasture", () => {
  const spring = scene("arable-spring"); const harvest = scene("arable-harvest"); const zoned = c25ZonedState();
  assert.deepEqual(farmProps(structuredClone(spring)), farmProps(spring));
  assert.ok(farmProps(spring).some(prop => prop.kind === "ox_plough_team"), "spring: a plough team");
  assert.ok(farmProps(harvest).some(prop => prop.kind === "ox_cart_hay"), "harvest: a hay cart");
  const pasture = new Set(zonesOf(zoned).filter(zone => zone.kind === "pasture").flatMap(zone => zone.membership));
  const animals = farmProps(zoned).filter(prop => prop.kind === "sheep_flock" || prop.kind === "cattle_pair");
  assert.ok(animals.length > 0);
  for (const animal of animals) assert.ok(pasture.has(animal.y * zoned.width + animal.x), `${animal.id} in pasture`);
});

test("Given fields migrated onto cleared forest When the ground scene lays ridge bands Then every arable zone with strips has bands (C1f)", async () => {
  const { buildGroundBoundaryScene } = await import("../src/render/groundBoundaryScene");
  const harvest = scene("arable-harvest");
  const layer = buildGroundBoundaryScene(harvest).zones;
  const withBands = new Set(layer.arableBands.map(band => band.zoneIndex));
  const arable = layer.zones.map((zone, index) => ({ zone, index })).filter(entry => entry.zone.kind === "arable");
  assert.ok(arable.length > 10);
  for (const { zone, index } of arable) assert.ok(withBands.has(index), `${zone.id} has ridge bands`);
});

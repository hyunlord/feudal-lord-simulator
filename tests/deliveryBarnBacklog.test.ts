/**
 * LB-15 (BOT-3, spec docs/design/labour.md): a mill's intake cart draws a barn backed up with 400+ wheat first.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnCarters } from "../src/agents/delivery";
import { BARN_BACKLOG_STOCK, fetchCandidate } from "../src/agents/deliveryBuildingCandidates";
import type { Building } from "../src/content/buildingConfig";
import { building, DELIVERY_INVENTORY, line, routePort } from "./deliveryFixtures";

const mill = (wheat = 0): Building => ({ ...building("mill", "mill", { inventory: { wheat } }), workers: 2 });
/** Routes from the mill: `near` 3 tiles, `far` 20, `farther` 30 (any building id not listed is 10). */
const lengths: Readonly<Record<string, number>> = { near: 3, far: 20, farther: 30 };
const path = (length: number) => line(...Array.from({ length: length + 1 }, (_, index) => [index, 0] as [number, number]));
const routes = routePort(Object.fromEntries(["near", "far", "farther", "store", "barn"].map(id => [`mill->${id}`, path(lengths[id] ?? 10)])));

test("LB-15 the threshold is 400 wheat", () => {
  assert.equal(BARN_BACKLOG_STOCK, 400);
});

test("LB-15 a far barn with 400 wheat goes before a nearer granary and a nearer barn", () => {
  const home = mill();
  const store = building("near", "granary", { inventory: { wheat: 40 } });
  const barn = building("store", "farmstead", { inventory: { wheat: 60 } });
  const backlog = building("far", "farmstead", { inventory: { wheat: BARN_BACKLOG_STOCK } });
  const choice = fetchCandidate(home, "wheat", [home, store, barn, backlog], DELIVERY_INVENTORY, routes);
  assert.equal(choice?.building.id, "far");
  assert.equal(choice?.amount, 12, "a full intake load");
});

test("LB-15 among backed-up barns the nearest", () => {
  const home = mill();
  const far = building("far", "farmstead", { inventory: { wheat: 500 } });
  const farther = building("farther", "farmstead", { inventory: { wheat: 907 } });
  assert.equal(fetchCandidate(home, "wheat", [home, farther, far], DELIVERY_INVENTORY, routes)?.building.id, "far");
});

test("LB-15 below 400 the nearest store or barn, as before (LB-7)", () => {
  const home = mill();
  const store = building("near", "granary", { inventory: { wheat: 40 } });
  const barn = building("far", "farmstead", { inventory: { wheat: BARN_BACKLOG_STOCK - 1 } });
  assert.equal(fetchCandidate(home, "wheat", [home, store, barn], DELIVERY_INVENTORY, routes)?.building.id, "near");
});

test("LB-15 the pile counts the barn's physical wheat; a pile other carts have all claimed is not a candidate", () => {
  const home = mill();
  const store = building("near", "granary", { inventory: { wheat: 40 } });
  const claimed = building("far", "farmstead", { inventory: { wheat: 400 }, stockReserved: { wheat: 400 } });
  assert.equal(fetchCandidate(home, "wheat", [home, store, claimed], DELIVERY_INVENTORY, routes)?.building.id, "near");
  const partly = building("far", "farmstead", { inventory: { wheat: 400 }, stockReserved: { wheat: 390 } });
  const choice = fetchCandidate(home, "wheat", [home, store, partly], DELIVERY_INVENTORY, routes);
  assert.equal(choice?.building.id, "far", "400 in the barn, 10 still free");
  assert.equal(choice?.amount, 10);
});

test("LB-15 only barns: a granary holding 400 wheat does not go first", () => {
  const home = mill();
  const store = building("near", "farmstead", { inventory: { wheat: 40 } });
  const granary = building("far", "granary", { inventory: { wheat: 400 } });
  assert.equal(fetchCandidate(home, "wheat", [home, store, granary], DELIVERY_INVENTORY, routes)?.building.id, "near");
});

test("LB-15 the delivery step sends the mill's intake cart to the backed-up barn", () => {
  const store = building("near", "granary", { inventory: { wheat: 40 } });
  const backlog = building("far", "farmstead", { inventory: { wheat: 907 } });
  const result = spawnCarters({ tick: 1, buildings: [mill(), store, backlog], walkers: [], inventory: DELIVERY_INVENTORY, routes });
  const intake = result.walkers.find(walker => walker.kind === "carter" && walker.homeBuildingId === "mill" && walker.cart === "intake");
  assert.ok(intake?.kind === "carter" && intake.mission === "fetch");
  assert.deepEqual(intake.destination, { kind: "building", buildingId: "far" });
  assert.equal(result.buildings.find(entry => entry.id === "far")?.stockReserved.wheat, 12);
});

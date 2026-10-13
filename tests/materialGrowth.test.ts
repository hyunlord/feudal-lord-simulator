/**
 * Option A (the user's rulings 2026-10-11/12/13, engine B's general rule (가)): what the next era and the next charter
 * building wait for, read from the data (a. the era's unmet material conditions, b. the next charter building's
 * materials, c. the supply chain's missing links), grows the town's timber and stone — lord mode only — and stops once
 * nothing waits. The state: seed 1 (lord slice) one season after its 1317 charter, from the 125-year run
 * engine-GROW2a-125y-aef5881 — no quarry, one masonry, no church, the stone town's 400 stone unmet.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import type { Building } from "../src/content/buildingConfig";
import { materialGrowthNeed, stoneDemandExpansionKind } from "../src/engine/autoplayMaterialGrowth";
import { waitingTimberNeed } from "../src/engine/autoplayTimberDemand";
import type { GameState } from "../src/engine/engine.types";
import { evaluateEraRequirements } from "../src/engine/era";
import { decodeSave } from "../src/save/saveCodec";

const charter = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/charter/seed1-1317-charter.save.json.gz")))).envelope.state as GameState;
let next = 0;
const staffed = (kind: "quarry" | "masonry" | "church"): Building => ({ id: `test-${kind}-${next++}`, kind, tx: 0, ty: 0,
  workers: kind === "quarry" ? 4 : kind === "masonry" ? 3 : 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 });
const withBuildings = (state: GameState, ...added: Building[]): GameState => ({ ...state, buildings: [...state.buildings, ...added] });

test("Option A a·b·c: the stone the stone town and the church wait for, and the quarry's timber beside the open sites'", () => {
  assert.equal(charter.era, "palisade");
  assert.deepEqual(evaluateEraRequirements(charter).filter(requirement => !requirement.met).map(requirement => requirement.key), ["stone"]);
  // a. 400 stone for the stone town + b. the church's 60 (it neither stands nor is placed).
  assert.equal(materialGrowthNeed(charter, "stone"), 400 + 60);
  // The open sites' timber (BT6) + b. the church's 100 + c. the quarry, the stone chain's missing link (the masonry stands).
  assert.equal(materialGrowthNeed(charter, "timber"), waitingTimberNeed(charter) + 100 + 50);
  assert.equal(stoneDemandExpansionKind(charter), "quarry", "no quarry: the chain's first link first");
});

test("Option A stops once nothing waits: the church placed and the stone town's stone in stock — no stone growth, the open sites' timber only", () => {
  const store = charter.buildings.find(building => building.kind === "storehouse")!;
  const stocked: GameState = { ...charter,
    buildings: [...charter.buildings.map(building => building.id === store.id ? { ...building, inventory: { ...building.inventory, stone: 400 } } : building),
      staffed("church"), staffed("quarry")] };
  assert.equal(evaluateEraRequirements(stocked).every(requirement => requirement.met), true);
  assert.equal(materialGrowthNeed(stocked, "stone"), 0);
  assert.equal(stoneDemandExpansionKind(stocked), null);
  assert.equal(materialGrowthNeed(stocked, "timber"), waitingTimberNeed(stocked));
});

test("Option A builds no more than the horizon wants: the staffed quarries and masonries that make the stone in time are enough", () => {
  // The church placed: 400 stone wait. Two quarries and a masonry make 40 a window (the quarries' raw stone, two a stone),
  // 400 over the ten-window horizon — enough, nothing more.
  const placed = withBuildings(charter, staffed("church"), staffed("quarry"), staffed("quarry"));
  assert.equal(materialGrowthNeed(placed, "stone"), 400);
  assert.equal(stoneDemandExpansionKind(placed), null);
  // One quarry and its masonry make 20 a window — short: the second quarry (the raw stone does not back up).
  const short = withBuildings(charter, staffed("church"), staffed("quarry"));
  assert.equal(stoneDemandExpansionKind(short), "quarry");
  // The raw stone already held counts (two to a stone): one quarry and 400 raw stone in a masonry make the 400 in time.
  const masonry = short.buildings.find(building => building.kind === "masonry" && !building.id.startsWith("test"))!;
  const stocked = { ...short, buildings: short.buildings.map(building => building.id === masonry.id ? { ...building, inventory: { ...building.inventory, stone_raw: 400 } } : building) };
  assert.equal(stoneDemandExpansionKind(stocked), null);
  // A masonry with no quarry and no raw stone makes nothing: the quarry first, however many masonries stand.
  assert.equal(stoneDemandExpansionKind(withBuildings(charter, staffed("church"), staffed("masonry"), staffed("masonry"))), "quarry");
  // Two quarries a masonry at most (⑥'s rule): the church unplaced (460 wait), two quarries and the masonry short of it —
  // the next stone facility is a masonry, not a third quarry.
  assert.equal(stoneDemandExpansionKind(withBuildings(charter, staffed("quarry"), staffed("quarry"))), "masonry");
});

test("Option A is lord mode's: the sandbox grows no stone (its BT6 reads the open sites only, autoplayTimberDemand)", () => {
  const { agency: _lord, ...sandbox } = charter;
  assert.equal(stoneDemandExpansionKind(sandbox), null);
});

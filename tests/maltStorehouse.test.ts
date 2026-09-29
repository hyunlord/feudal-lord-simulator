/**
 * FIX-8 (spec docs/design/ale-chain.md AL-12, decision FX8-1): malt is kept in the storehouse, not the granary — the
 * granary is the town's food store. The kiln's cart takes malt to a storehouse up to a quarter of its room, else the
 * kiln holds it and the brewsters fetch from it; malt left in a granary goes to the brewsters first; an old save's
 * granary malt is carried to the storehouses.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { deliverCandidate } from "../src/agents/deliveryBuildingCandidates";
import { ALE_BALANCE } from "../src/content/aleConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { STORAGE_KIND_BY_RESOURCE } from "../src/content/resourceCatalog";
import { advanceAle } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import { initialPolitics } from "../src/engine/politics";
import { advanceTick } from "../src/engine/tick";
import { availableSpace } from "../src/economy/storage";
import { migrateV27ToV28 } from "../src/save/migrations/v27ToV28";
import { decodeSave } from "../src/save/saveCodec";
import { clothTown } from "./helpers/clothTown";

const building = (id: string, kind: Building["kind"], inventory: Building["inventory"]): Building =>
  ({ id, kind, tx: 0, ty: 0, workers: 2, inventory, reserved: {}, stockReserved: {}, productionProgress: 0 });
const ports = {
  inventory: { availableStock: (from: Building, resource: string) => from.inventory[resource as "malt"] ?? 0, availableSpace: (to: Building) => availableSpace(to, BUILDING_CONFIG_BY_KIND[to.kind]) } as never,
  routes: { betweenBuildings: () => [{ tx: 0, ty: 0 }] } as never,
};
const MALT_SHARE = Math.floor(BUILDING_CONFIG_BY_KIND.storehouse.storageCapacity * ALE_BALANCE.maltStorePermille / 1000);

test("M1 the kiln's cart takes malt to a storehouse, never to a granary, up to a quarter of the store's room", () => {
  assert.equal(STORAGE_KIND_BY_RESOURCE.malt, "storehouse");
  assert.equal(MALT_SHARE, 50);
  const kiln = building("kiln", "malt_kiln", { malt: 20 });
  const granary = building("granary", "granary", {});
  const store = (malt: number) => building("store", "storehouse", { malt });
  assert.equal(deliverCandidate(kiln, "malt", [kiln, granary], ports.inventory, ports.routes), null, "no storehouse: the kiln holds its malt");
  const empty = deliverCandidate(kiln, "malt", [kiln, granary, store(0)], ports.inventory, ports.routes);
  assert.equal(empty?.building.id, "store");
  assert.equal(deliverCandidate(kiln, "malt", [kiln, granary, store(MALT_SHARE - 1)], ports.inventory, ports.routes)?.amount, 1);
  assert.equal(deliverCandidate(kiln, "malt", [kiln, granary, store(MALT_SHARE)], ports.inventory, ports.routes), null, "its share full: the kiln holds it");
});

test("M2 malt left in a granary goes to the brewsters first, then the nearest store", () => {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
  const home = state.buildings.find(candidate => candidate.id === state.houses[0]!.buildingId)!;
  const kiln: Building = { ...building("malt_kiln-test", "malt_kiln", { malt: 20 }), tx: home.tx + 1, ty: home.ty + 1 };
  const granary = state.buildings.find(candidate => candidate.kind === "granary")!;
  const town: GameState = { ...state, politics: initialPolitics(state), tick: 400 * 1000,
    buildings: [...state.buildings.map(candidate => candidate === granary ? { ...granary, inventory: { ...granary.inventory, malt: 3 } } : candidate), kiln] };
  const next = advanceAle(town);
  const held = (at: GameState, id: string) => at.buildings.find(candidate => candidate.id === id)!.inventory.malt ?? 0;
  const taken = 3 + 20 - held(next, granary.id) - held(next, kiln.id);
  assert.ok(taken > 3, `the brewsters fetched ${taken}`);
  assert.equal(held(next, granary.id), 0, "the granary's malt went first");
});

test("M3 the save step v27 → v28 carries a granary's malt to the storehouses' free room; what does not fit stays", () => {
  const envelope = { schemaVersion: 27, state: { buildings: [
    building("granary-b", "granary", { malt: 60, bread: 40 }), building("granary-a", "granary", { malt: 150 }),
    building("store-b", "storehouse", { timber: 170 }), building("store-a", "storehouse", { timber: 100 }), building("kiln", "malt_kiln", { malt: 5 }),
  ] } };
  const next = migrateV27ToV28(envelope) as typeof envelope;
  assert.equal(next.schemaVersion, 28);
  const of = (id: string) => next.state.buildings.find(candidate => candidate.id === id)!.inventory;
  assert.deepEqual(of("store-a"), { timber: 100, malt: 100 });
  assert.deepEqual(of("store-b"), { timber: 170, malt: 30 });
  assert.deepEqual(of("granary-a"), { malt: 20 }, "the moved 130 taken from the first granary (id order)");
  assert.deepEqual(of("granary-b"), { malt: 60, bread: 40 });
  assert.deepEqual(of("kiln"), { malt: 5 });
  const none = { schemaVersion: 27, state: { buildings: [building("granary", "granary", { bread: 10 })] } };
  assert.deepEqual(migrateV27ToV28(none), { ...none, schemaVersion: 28 });
});

test("M4 the chapter-4 town (its storehouses full) runs a year: its granaries take no malt, the kiln holds at most its own", () => {
  let state = clothTown();
  const malt = (at: GameState, kind: Building["kind"]) => at.buildings.filter(candidate => candidate.kind === kind).reduce((sum, candidate) => sum + (candidate.inventory.malt ?? 0), 0);
  let granaryMalt = malt(state, "granary");
  for (let step = 0; step < 4000; step += 1) {
    state = advanceTick(state);
    const now = malt(state, "granary");
    assert.ok(now <= granaryMalt, `granary malt rose at ${state.tick}: ${granaryMalt} → ${now}`);
    granaryMalt = now;
  }
  assert.equal(granaryMalt, 0, "the old malt drawn");
  for (const kiln of state.buildings.filter(candidate => candidate.kind === "malt_kiln")) assert.ok((kiln.inventory.malt ?? 0) <= BUILDING_CONFIG_BY_KIND.malt_kiln.production!.outputHoldLimit!);
  for (const store of state.buildings.filter(candidate => candidate.kind === "storehouse")) assert.ok((store.inventory.malt ?? 0) <= MALT_SHARE);
});

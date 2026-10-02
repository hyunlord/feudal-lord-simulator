/**
 * FIX-16 (③): a palisade costs 8 timber a step (was 15), and while the next charter building (the market, then the
 * church) waits for timber the palisade does not take it all — unplaced, the palisade leaves its building cost in stock
 * and takes at most half of the rest; placed and still short, at most half of the stock.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { spawnCarters } from "../src/agents/delivery";
import type { CarterWalker } from "../src/agents/walker.types";
import { createConstructionSite, createPalisadeConstructionSite } from "../src/economy/construction";
import { charterTimberWait, CHARTER_WAIT_WALL_SHARE_PERMILLE, NO_CHARTER_WAIT } from "../src/domain/wallReserve";
import { DELIVERY_INVENTORY, building, line, routePort } from "./deliveryFixtures";

const wall = createPalisadeConstructionSite({ id: "wall-1", wallId: "wall", segmentIndex: 0, gateDistance: 0, order: 0,
  path: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }], startedTick: 0 });
const cost = (kind: "market" | "church") => (kind === "market" ? 60 : 100);
const routes = routePort({ "store->wall-1": line([0, 0], [1, 0]) });
const dispatch = (buildings: Parameters<typeof spawnCarters>[0]["buildings"], sites: Parameters<typeof spawnCarters>[0]["constructionSites"] = [wall]) =>
  spawnCarters({ tick: 1, buildings, constructionSites: sites, walkers: [], treasuryTimber: 0, inventory: DELIVERY_INVENTORY, routes, wallConstructionPriority: "balanced" });
const wallCargo = (result: ReturnType<typeof spawnCarters>) =>
  result.walkers.filter(walker => (walker as CarterWalker).destination?.kind === "construction_site").map(walker => (walker as CarterWalker).cargo?.amount ?? 0);

test("FIX-16 a palisade step costs 8 timber (a 4-step segment 32, was 60)", () => {
  assert.equal(wall.required.timber, 4 * 8);
});

test("FIX-16 the next charter building: the market until it stands, then the church; none once both stand", () => {
  const market = building("market-1", "market", {});
  const church = building("church-1", "church", {});
  assert.deepEqual(charterTimberWait([], [], cost), { keep: 60, wallSharePermille: CHARTER_WAIT_WALL_SHARE_PERMILLE });
  assert.deepEqual(charterTimberWait([market], [], cost), { keep: 100, wallSharePermille: CHARTER_WAIT_WALL_SHARE_PERMILLE });
  assert.deepEqual(charterTimberWait([market, church], [], cost), NO_CHARTER_WAIT);
  // A placed market still short of timber: no stock kept back, the palisade takes at most half.
  const site = createConstructionSite({ ordinal: 1, kind: "market", tx: 9, ty: 9, startedTick: 0 });
  assert.deepEqual(charterTimberWait([], [site], cost), { keep: 0, wallSharePermille: CHARTER_WAIT_WALL_SHARE_PERMILLE });
  const supplied = { ...site, delivered: { timber: 60 } };
  assert.deepEqual(charterTimberWait([], [supplied], cost), NO_CHARTER_WAIT);
});

test("FIX-16 before the market is placed the palisade leaves its 60 timber and takes at most half of the rest", () => {
  // 50 in stock: under the market's 60, the palisade takes nothing — the stock grows until the market can be placed.
  assert.deepEqual(wallCargo(dispatch([building("store", "storehouse", { inventory: { timber: 50 } })])), []);
  // 70 in stock: half of the 10 above the market's 60.
  assert.deepEqual(wallCargo(dispatch([building("store", "storehouse", { inventory: { timber: 70 } })])), [5]);
  // With the market and church standing, the palisade takes what the carter can carry.
  const standing = [building("market-1", "market", {}), building("church-1", "church", {})];
  const full = wallCargo(dispatch([building("store", "storehouse", { inventory: { timber: 70 } }), ...standing]));
  assert.equal(full.length, 1);
  assert.ok(full[0]! > 5);
});

test("FIX-16 a placed market short of timber leaves the palisade at most half of the stock", () => {
  const market = createConstructionSite({ ordinal: 1, kind: "market", tx: 9, ty: 9, startedTick: 0 });
  // The market has no route here (the palisade cut it off, as in the playthrough): it cannot take the timber, and the
  // palisade still takes only half of the 10 in stock.
  assert.deepEqual(wallCargo(dispatch([building("store", "storehouse", { inventory: { timber: 10 } })], [wall, market])), [5]);
});

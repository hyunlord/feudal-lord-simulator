/**
 * RECOVER-1 (spec docs/design/recovery.md RC-5, RC-6): in lord mode a granary keeps room for bread and wheat — barley
 * fills at most 40 % of it (the user's decision 2026-10-06) — and the carters' spare loads bring barn wheat to the mills
 * under their reorder point and the granaries under their wheat target. The sandbox keeps the stores' own rules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { INPUT_PULL, LORD_INTAKE_CAPS } from "../src/content/recoveryConfig";
import { availableSpace, storageIntakeSpace } from "../src/economy/storage";
import type { GameState } from "../src/engine/engine.types";
import { LORD_INTAKE_RULES, lordIntakeRules } from "../src/engine/recovery";
import { haulStuckStock, initialTrades } from "../src/engine/trades";
import type { TradeHousehold } from "../src/engine/trades.types";
import { initialAgency } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";

const load = (): GameState => decodeSave(new Uint8Array(readFileSync("fixtures/saves/v50/chapter-two-town.save.json"))).envelope.state as GameState;

test("RC-6 in lord mode barley fills at most 40 % of a granary; the sandbox keeps the store's own room", () => {
  const town = load();
  const granary = { ...town.buildings.find(building => building.kind === "granary")!, inventory: { barley: 70 }, reserved: {}, stockReserved: {} };
  const free = availableSpace(granary, BUILDING_CONFIG_BY_KIND.granary);
  const cap = Math.floor(BUILDING_CONFIG_BY_KIND.granary.storageCapacity * LORD_INTAKE_CAPS.find(line => line.store === "granary" && line.resource === "barley")!.permille / 1000);
  assert.equal(storageIntakeSpace(granary, "barley", free, lordIntakeRules({ agency: initialAgency() })), cap - 70);
  assert.equal(storageIntakeSpace(granary, "barley", free, lordIntakeRules({})), free);
  assert.equal(storageIntakeSpace({ ...granary, inventory: { barley: cap } }, "barley", free, LORD_INTAKE_RULES), 0);
  assert.ok(storageIntakeSpace({ ...granary, inventory: { barley: cap } }, "bread", free, LORD_INTAKE_RULES) > 0, "bread keeps its room");
});

test("DTR-19 from the palisade on, timber and logs together fill at most half a storehouse, stone_raw keeps its own half; the hamlet keeps the store whole", () => {
  const town = load();
  const store = { ...town.buildings.find(building => building.kind === "storehouse")!, inventory: {}, reserved: {}, stockReserved: {} };
  const room = BUILDING_CONFIG_BY_KIND.storehouse.storageCapacity;
  const share = (resource: string) => Math.floor(room * LORD_INTAKE_CAPS.find(line => line.store === "storehouse" && line.resource === resource)!.permille / 1000);
  const rules = (era: "hamlet" | "palisade" | "stone_town") => lordIntakeRules({ agency: initialAgency(), era });
  const space = (inventory: Record<string, number>, resource: "timber" | "logs" | "stone_raw" | "stone", era: "hamlet" | "palisade" | "stone_town") => {
    const filled = { ...store, inventory };
    return storageIntakeSpace(filled, resource, availableSpace(filled, BUILDING_CONFIG_BY_KIND.storehouse), rules(era));
  };
  assert.equal(share("timber") + share("logs"), room / 2, "wood together half");
  assert.equal(space({ timber: share("timber") }, "timber", "palisade"), 0, "timber at its share");
  assert.equal(space({ logs: share("logs") }, "logs", "stone_town"), 0, "logs at theirs");
  const wood = { timber: share("timber"), logs: share("logs") };
  assert.ok(space(wood, "stone_raw", "palisade") >= room / 2 - 1, "the quarry's stone keeps its room with the wood full");
  assert.ok(space(wood, "stone", "palisade") > 0);
  assert.ok(space({ timber: share("timber") }, "timber", "hamlet") > 0, "in the hamlet the charter's timber has the whole store");
  assert.equal(space({ timber: share("timber") }, "timber", "palisade"), 0);
  assert.ok(storageIntakeSpace({ ...store, inventory: { timber: share("timber") } }, "timber", 100, lordIntakeRules({})) > 0, "the sandbox keeps the store's own room");
  // A wall waiting on timber: the wood's lines wait (its reserve and deliveries need the stores whole); stone_raw's stays.
  const walling = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v53/palisade-construction.save.json"))).envelope.state as GameState;
  const sites = walling.constructionSites.filter(site => site.kind === "palisade_segment");
  assert.ok(sites.length > 0);
  const waiting = lordIntakeRules({ agency: initialAgency(), era: "palisade", constructionSites: sites });
  assert.equal(waiting!.caps!.some(line => line.resource === "timber" || line.resource === "logs"), false);
  assert.equal(waiting!.caps!.some(line => line.resource === "stone_raw"), true);
});

test("RC-5 the carters' spare loads bring barn wheat to the neediest mill or granary, from the nearest barn", () => {
  const town = { ...load(), agency: initialAgency() };
  const barn = town.buildings.find(building => building.kind === "farmstead")!;
  const mill = town.buildings.find(building => building.kind === "mill")!;
  const state: GameState = { ...town, buildings: town.buildings.map(building =>
    building.id === barn.id ? { ...building, inventory: { ...building.inventory, wheat: 300 }, stockReserved: {} }
      : building.kind === "mill" ? { ...building, inventory: { ...building.inventory, wheat: building.id === mill.id ? 0 : 99 }, reserved: {} }
        : building.kind === "granary" ? { ...building, inventory: { ...building.inventory, wheat: INPUT_PULL.chains[0]!.stores[0]!.target } }
          : building.kind === "farmstead" ? { ...building, inventory: { ...building.inventory, wheat: 0 } } : building) };
  const carter = { tradeId: "carter" } as unknown as TradeHousehold;
  const hauled = haulStuckStock(state, { ...initialTrades(), households: [carter] });
  const after = (id: string) => hauled.state.buildings.find(building => building.id === id)!;
  assert.ok(hauled.moved > 0, "a spare load moved");
  assert.ok((after(mill.id).inventory.wheat ?? 0) > 0, "the empty mill got wheat");
  assert.equal((after(barn.id).inventory.wheat ?? 0) + (after(mill.id).inventory.wheat ?? 0), 300, "nothing made or lost");
  // No carter, nothing moves.
  assert.equal(haulStuckStock(state, initialTrades()).moved, 0);
});

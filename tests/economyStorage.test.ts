import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
  type BuildingKind,
} from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import {
  acceptsResource,
  availableSpace,
  availableStock,
  releaseReservation,
  releaseStockReservation,
  reserve,
  reserveStock,
  withdrawReservedStock,
} from "../src/economy/storage";

function building(
  kind: BuildingKind,
  inventory: Partial<Record<ResourceType, number>> = {},
  reserved: Partial<Record<ResourceType, number>> = {},
  stockReserved: Partial<Record<ResourceType, number>> = {},
): Building {
  return {
    id: `${kind}-test`,
    kind,
    tx: 0,
    ty: 0,
    workers: 0,
    inventory,
    reserved,
    stockReserved,
    productionProgress: 0,
  };
}

test("granaries accept only food and storehouses accept only materials", () => {
  assert.equal(acceptsResource("granary", "wheat"), true);
  assert.equal(acceptsResource("granary", "bread"), true);
  assert.equal(acceptsResource("granary", "logs"), false);
  assert.equal(acceptsResource("granary", "timber"), false);
  assert.equal(acceptsResource("storehouse", "logs"), true);
  assert.equal(acceptsResource("storehouse", "timber"), true);
  assert.equal(acceptsResource("storehouse", "wheat"), false);
  assert.equal(acceptsResource("storehouse", "bread"), false);
  assert.equal(acceptsResource("mill", "wheat"), false);
});

test("available space is shared across resources and subtracts inbound reservations", () => {
  const storehouse = building(
    "storehouse",
    { logs: 120, timber: 70 },
    { timber: 7 },
  );

  assert.equal(
    availableSpace(storehouse, BUILDING_CONFIG_BY_KIND.storehouse),
    3,
  );
});

test("reservation claims only valid unreserved space and prevents a second last-slot claim", () => {
  const initial = building("storehouse", { timber: 199 });
  const first = reserve(initial, "timber", 8);
  const second = reserve(first, "timber", 1);

  assert.equal(first.reserved.timber, 1);
  assert.equal(
    availableSpace(first, BUILDING_CONFIG_BY_KIND.storehouse),
    0,
  );
  assert.deepEqual(second, first);
  assert.deepEqual(reserve(initial, "bread", 1), initial);
});

test("reservation release clamps at zero and is idempotent", () => {
  const initial = building("granary", {}, { bread: 3 });
  const released = releaseReservation(initial, "bread", 8);

  assert.equal(released.reserved.bread ?? 0, 0);
  assert.deepEqual(releaseReservation(released, "bread", 1), released);
});

test("converter local storage may reserve its own input or output without becoming a public store", () => {
  const mill = building("mill");
  const wheat = reserve(mill, "wheat", 3);
  const bread = reserve(wheat, "bread", 2);

  assert.equal(acceptsResource("mill", "wheat"), false);
  assert.deepEqual(bread.reserved, { wheat: 3, bread: 2 });
  assert.deepEqual(reserve(bread, "logs", 1), bread);
});

test("outbound stock reservations prevent duplicate fetch claims", () => {
  const initial = building("granary", { wheat: 9 });
  const first = reserveStock(initial, {
    buildingId: initial.id,
    resource: "wheat",
    amount: 8,
  });
  const second = reserveStock(first, {
    buildingId: initial.id,
    resource: "wheat",
    amount: 8,
  });

  assert.equal(first.stockReserved.wheat, 8);
  assert.equal(second.stockReserved.wheat, 9);
  assert.equal(availableStock(second, "wheat"), 0);
});

test("withdrawing reserved stock is atomic and conserves the source inventory", () => {
  const initial = building("granary", { wheat: 5 }, {}, { wheat: 4 });
  const withdrawal = withdrawReservedStock(initial, "wheat", 4);

  assert.equal(withdrawal.withdrawn, 4);
  assert.equal(withdrawal.building.inventory.wheat, 1);
  assert.equal(withdrawal.building.stockReserved.wheat ?? 0, 0);
  assert.deepEqual(
    releaseStockReservation(withdrawal.building, "wheat", 4),
    withdrawal.building,
  );
});

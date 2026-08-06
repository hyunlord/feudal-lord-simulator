import assert from "node:assert/strict";
import test from "node:test";

import { spawnCarters } from "../src/agents/delivery";
import type { CarterWalker } from "../src/agents/walker.types";
import {
  DELIVERY_INVENTORY,
  building,
  line,
  routePort,
} from "./deliveryFixtures";

test("baseline normal delivery keeps observable building mission behavior", () => {
  // Given
  const producer = building("producer", "logging_camp", {
    inventory: { logs: 9 },
  });
  const store = building("store", "storehouse");
  const routes = routePort({
    "producer->store": line([0, 0], [1, 0], [2, 0]),
  });

  // When
  const result = spawnCarters({
    tick: 19,
    buildings: [producer, store],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes,
  });
  const carter = result.walkers[0] as CarterWalker;

  // Then
  assert.deepEqual(carter.destination, {
    kind: "building",
    buildingId: store.id,
  });
  assert.deepEqual(carter.reservation, {
    destination: {
      kind: "building",
      buildingId: store.id,
    },
    resource: "logs",
    amount: 8,
    sourceStockClaim: null,
    homeCapacityClaim: {
      buildingId: producer.id,
      resource: "logs",
      amount: 8,
    },
  });
  assert.deepEqual(carter.path, line([0, 0], [1, 0], [2, 0]));
  assert.deepEqual(carter.cargo, { resource: "logs", amount: 8 });
  assert.equal(result.walkers.length, 1);
});

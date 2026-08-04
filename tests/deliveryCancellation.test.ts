import assert from "node:assert/strict";
import test from "node:test";

import { spawnCarters, stepCarters } from "../src/agents/delivery";
import type { CarterWalker } from "../src/agents/walker.types";
import {
  DELIVERY_INVENTORY,
  building,
  line,
  routePort,
} from "./deliveryFixtures";

const arrived = (carter: CarterWalker): CarterWalker => ({
  ...carter,
  position: carter.path.at(-1) ?? carter.position,
  pathIndex: Math.max(0, carter.path.length - 1),
});

test("a delivered carter despawns logically when no road path home exists", () => {
  const producer = building("producer", "logging_camp", {
    inventory: { logs: 3 },
  });
  const store = building("store", "storehouse");
  const spawned = spawnCarters({
    tick: 80,
    buildings: [producer, store],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "producer->store": line([0, 0], [1, 0]),
    }),
  });
  const delivered = stepCarters({
    tick: 81,
    buildings: spawned.buildings,
    walkers: [arrived(spawned.walkers[0] as CarterWalker)],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "producer->store": line([0, 0], [1, 0]),
    }),
  });

  assert.deepEqual(delivered.walkers, []);
  assert.equal(
    delivered.buildings.find(({ id }) => id === store.id)?.inventory.logs,
    3,
  );
  assert.equal(
    delivered.buildings.find(({ id }) => id === store.id)?.reserved.logs ?? 0,
    0,
  );
});

test("a vanished fetch source cancels without leaking either reservation", () => {
  const mill = building("mill", "mill");
  const granary = building("granary", "granary", {
    inventory: { wheat: 8 },
  });
  const outbound = line([0, 0], [1, 0]);
  const spawned = spawnCarters({
    tick: 90,
    buildings: [mill, granary],
    walkers: [],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "mill->granary": outbound,
    }),
  });
  const depleted = spawned.buildings.map((candidate) =>
    candidate.id === granary.id ? { ...candidate, inventory: {} } : candidate,
  );
  const cancelled = stepCarters({
    tick: 91,
    buildings: depleted,
    walkers: [arrived(spawned.walkers[0] as CarterWalker)],
    inventory: DELIVERY_INVENTORY,
    routes: routePort({
      "1,0->mill": line([1, 0], [0, 0]),
    }),
  });
  const carter = cancelled.walkers[0] as CarterWalker;

  assert.equal(carter.cancellation?.reason, "source_unavailable");
  assert.equal(carter.cargo, null);
  assert.equal(
    cancelled.buildings.find(({ id }) => id === mill.id)?.reserved.wheat ?? 0,
    0,
  );
  assert.equal(
    cancelled.buildings.find(({ id }) => id === granary.id)?.stockReserved.wheat ?? 0,
    0,
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import { findNearestSource } from "../src/economy/demand";

function building(
  id: string,
  kind: BuildingKind,
  tx: number,
  inventory: Partial<Record<ResourceType, number>> = {},
  stockReserved: Partial<Record<ResourceType, number>> = {},
): Building {
  return {
    id,
    kind,
    tx,
    ty: 0,
    workers: 0,
    inventory,
    reserved: {},
    stockReserved,
    productionProgress: 0,
  };
}

test("findNearestSource ignores reserved or empty stock and ties by building id", () => {
  const requester = building("mill", "mill", 5);
  const buildings = [
    requester,
    building("granary-b", "granary", 3, { wheat: 4 }),
    building("granary-a", "granary", 7, { wheat: 4 }),
    building("granary-reserved", "granary", 4, { wheat: 4 }, { wheat: 4 }),
  ];

  assert.equal(
    findNearestSource(buildings, {
      requesterBuildingId: requester.id,
      resource: "wheat",
      amount: 8,
    })?.id,
    "granary-a",
  );
});

test("findNearestSource uses a caller road-distance and rejects unreachable candidates", () => {
  const requester = building("mill", "mill", 5);
  const buildings = [
    requester,
    building("granary-near-air", "granary", 4, { wheat: 4 }),
    building("granary-road", "granary", 20, { wheat: 4 }),
  ];

  assert.equal(
    findNearestSource(
      buildings,
      {
        requesterBuildingId: requester.id,
        resource: "wheat",
        amount: 8,
      },
      (source) => source.id === "granary-road" ? 6 : null,
    )?.id,
    "granary-road",
  );
});

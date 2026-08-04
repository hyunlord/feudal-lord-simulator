import assert from "node:assert/strict";
import test from "node:test";

import {
  currentRoadTile,
  hasArrivedAtPathEnd,
  lastReachedRoadTile,
  stepWalkerAlongPath,
} from "../src/agents/movement";
import type { CarterWalker, DistributorWalker } from "../src/agents/walker.types";

const carter: CarterWalker = {
  kind: "carter",
  id: "carter-1",
  homeBuildingId: "farm-1",
  position: { tx: 0, ty: 0 },
  path: [
    { tx: 0, ty: 0 },
    { tx: 1, ty: 0 },
    { tx: 2, ty: 0 },
    { tx: 2, ty: 1 },
  ],
  pathIndex: 0,
  previousTile: null,
  cargo: { resource: "wheat", amount: 8 },
  spawnedTick: 10,
  mission: "deliver",
  phase: "outbound",
  destinationBuildingId: "granary-1",
  reservation: {
    destinationBuildingId: "granary-1",
    resource: "wheat",
    amount: 8,
    sourceStockClaim: null,
    homeCapacityClaim: null,
  },
  cancellation: null,
};

test("stepWalkerAlongPath advances across multiple road waypoints when distance exceeds one tile", () => {
  // Given
  const distance = 2.25;

  // When
  const moved = stepWalkerAlongPath(carter, distance);

  // Then
  assert.equal(moved.pathIndex, 2);
  assert.deepEqual(moved.previousTile, { tx: 1, ty: 0 });
  assert.deepEqual(moved.position, { tx: 2, ty: 0.25 });
  assert.deepEqual(currentRoadTile(moved), { tx: 2, ty: 1 });
  assert.deepEqual(lastReachedRoadTile(moved), { tx: 2, ty: 0 });
  assert.equal(hasArrivedAtPathEnd(moved), false);
});

test("stepWalkerAlongPath preserves axis isolation on each road segment", () => {
  // Given
  const walker: DistributorWalker = {
    kind: "distributor",
    id: "distributor-1",
    homeBuildingId: "granary-1",
    position: { tx: 2, ty: 1 },
    path: [
      { tx: 2, ty: 1 },
      { tx: 2, ty: 4 },
    ],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "bread", amount: 12 },
    spawnedTick: 20,
    phase: "roaming",
    junctionVisits: 0,
    tilesTravelled: 0,
    priorTile: null,
  };

  // When
  const moved = stepWalkerAlongPath(walker, 1.5);

  // Then
  assert.deepEqual(moved.position, { tx: 2, ty: 2.5 });
  assert.equal(moved.position.tx, walker.position.tx);
  assert.equal(moved.pathIndex, 0);
  assert.deepEqual(moved.previousTile, null);
});

test("stepWalkerAlongPath clamps at arrival and reports the final road tile", () => {
  // Given
  const distance = 8;

  // When
  const moved = stepWalkerAlongPath(carter, distance);

  // Then
  assert.deepEqual(moved.position, { tx: 2, ty: 1 });
  assert.equal(moved.pathIndex, 3);
  assert.deepEqual(moved.previousTile, { tx: 2, ty: 0 });
  assert.deepEqual(currentRoadTile(moved), { tx: 2, ty: 1 });
  assert.equal(hasArrivedAtPathEnd(moved), true);
});

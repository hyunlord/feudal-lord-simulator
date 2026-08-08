import assert from "node:assert/strict";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import type { GameState } from "../src/engine/engine.types";
import { interpolatedWalkerPositions } from "../src/render/walkerInterpolation";
import { objectRenderItemsForFrame } from "../src/render/renderObjectFrameCache";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number): Tile {
  return { tx, ty, terrain: "grass", buildingId: null, hasRoad: false };
}

function walker(id: string, tx: number, ty: number): Walker {
  return {
    id,
    kind: "distributor",
    homeBuildingId: "granary",
    position: { tx, ty },
    path: [{ tx, ty }],
    pathIndex: 0,
    previousTile: null,
    cargo: null,
    spawnedTick: 0,
    phase: "roaming",
    junctionVisits: 0,
    tilesTravelled: 0,
    priorTile: null,
  };
}

function stateWithWalkers(walkers: readonly Walker[]): Pick<GameState, "walkers"> {
  return { walkers: [...walkers] };
}

test("interpolatedWalkerPositions blends matched walkers and keeps sources immutable", () => {
  // Given
  const previous = walker("walker-1", 0, 0);
  const current = walker("walker-1", 2, 0);

  // When
  const renderWalkers = interpolatedWalkerPositions({
    previous: stateWithWalkers([previous]),
    current: stateWithWalkers([current]),
    alpha: 0.5,
  });

  // Then
  assert.deepEqual(renderWalkers[0]?.position, { tx: 1, ty: 0 });
  assert.deepEqual(previous.position, { tx: 0, ty: 0 });
  assert.deepEqual(current.position, { tx: 2, ty: 0 });
});

test("interpolatedWalkerPositions renders spawned and removed walkers without pop or ghost", () => {
  // Given
  const continuing = walker("continuing", 0, 0);
  const moved = walker("continuing", 2, 0);
  const spawned = walker("spawned", 4, 0);
  const removed = walker("removed", 6, 0);

  // When
  const rendered = interpolatedWalkerPositions({
    previous: stateWithWalkers([continuing, removed]),
    current: stateWithWalkers([moved, spawned]),
    alpha: 0.5,
  });

  // Then
  assert.deepEqual(rendered.map(({ id, position }) => ({ id, position })), [
    { id: "continuing", position: { tx: 1, ty: 0 } },
    { id: "spawned", position: { tx: 4, ty: 0 } },
  ]);
});

test("interpolatedWalkerPositions renders current positions when alpha is complete", () => {
  // Given
  const previous = walker("walker-1", 0, 0);
  const current = walker("walker-1", 2, 0);

  // When
  const renderWalkers = interpolatedWalkerPositions({
    previous: stateWithWalkers([previous]),
    current: stateWithWalkers([current]),
    alpha: 1,
  });

  // Then
  assert.deepEqual(renderWalkers[0]?.position, { tx: 2, ty: 0 });
});

test("objectRenderItemsForFrame uses render walkers without mutating simulation walkers", () => {
  // Given
  const tiles = [tile(0, 0), tile(1, 0), tile(2, 0)];
  const simulationWalker = walker("walker-rendered", 2, 0);
  const renderWalker = { ...simulationWalker, position: { tx: 1, ty: 0 } };
  const state = {
    tick: 0,
    seed: 23,
    tiles,
    width: 3,
    height: 1,
    buildings: [],
    constructionSites: [],
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: [simulationWalker],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    treasuryCoin: 0,
    roadRevision: 0,
    pathCache: {},
    forestHarvests: [],
  } satisfies GameState;
  const input = {
    state,
    visibleTiles: tiles,
    range: { minTx: 0, minTy: 0, maxTx: 2, maxTy: 0 },
    includeGroundCover: false,
    renderWalkers: [renderWalker],
  };

  // When
  const items = objectRenderItemsForFrame(input);
  const renderedWalker = items.find((item) => item.kind === "walker");

  // Then
  assert.equal(renderedWalker?.kind, "walker");
  assert.deepEqual(renderedWalker.walker.position, { tx: 1, ty: 0 });
  assert.deepEqual(state.walkers[0]?.position, { tx: 2, ty: 0 });
});

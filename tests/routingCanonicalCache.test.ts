import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { resolveBuildingRoute } from "../src/engine/routing";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { Tile } from "../src/world/world.types";

test("building-pair route cache is independent of request order", () => {
  const left: Building = {
    id: "z-house",
    kind: "house",
    tx: 2,
    ty: 2,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
  const right: Building = { ...left, id: "a-house", tx: 5, ty: 5 };
  const roads = new Set([
    "1,2", "1,3", "1,4", "1,5", "1,6", "2,6", "3,6", "3,5", "4,5", "4,6",
  ]);
  const tiles: Tile[] = Array.from({ length: 64 }, (_unused, index) => {
    const tx = index % 8;
    const ty = Math.floor(index / 8);
    return {
      tx,
      ty,
      terrain: "grass",
      buildingId: tx === left.tx && ty === left.ty ? left.id : tx === right.tx && ty === right.ty ? right.id : null,
      hasRoad: roads.has(`${tx},${ty}`),
    };
  });
  const state = {
    ...DEFAULT_GAME_STATE,
    width: 8,
    height: 8,
    tiles,
    buildings: [left, right],
    houses: [],
    palisade: null,
    roadRevision: 7,
    pathCache: {},
  };

  const leftFirst = resolveBuildingRoute(state, left, right);
  const rightFirst = resolveBuildingRoute(state, right, left);

  assert.ok(leftFirst.path);
  assert.deepEqual(leftFirst.path, [...(rightFirst.path ?? [])].reverse());
  assert.deepEqual(leftFirst.pathCache, rightFirst.pathCache);
  assert.equal(Object.keys(leftFirst.pathCache).length, 1);
  assert.deepEqual(
    resolveBuildingRoute({ ...state, pathCache: leftFirst.pathCache }, right, left).path,
    rightFirst.path,
  );
});

test("24-lot natural city has the same state after 24,000 ticks with a retained or cleared route cache", () => {
  const fixture = new URL("./fixtures/wall/seed1-24lot-final-state.json.gz", import.meta.url);
  const initial = JSON.parse(gunzipSync(readFileSync(fixture)).toString("utf8")) as GameState;
  assert.equal(initial.houses.length, 24);
  assert.equal(initial.population, 768);
  assert.ok(Object.keys(initial.pathCache).length > 0);

  let retained = initial;
  let cleared: GameState = { ...initial, pathCache: {} };
  for (let tick = 0; tick < 24_000; tick += 1) {
    retained = advanceTick(retained);
    cleared = advanceTick(cleared);
  }

  const meaningfulHash = (state: GameState): string => {
    const { pathCache: _derived, ...meaningful } = state;
    return createHash("sha256").update(JSON.stringify(meaningful)).digest("hex");
  };
  assert.equal(meaningfulHash(cleared), meaningfulHash(retained));
});

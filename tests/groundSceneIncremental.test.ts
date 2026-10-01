import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import type { GameState } from "../src/engine/engine.types";
import {
  beginGroundSceneFrame, buildGroundBoundaryScene, groundBoundaryScene, groundBoundarySceneStats, setGroundSceneIncrementalBuild,
  setGroundSceneReverseInput, setGroundSceneZoneDeferral, type GroundBoundaryScene,
} from "../src/render/groundBoundaryScene";
import { groundSceneSteps, runGroundSceneSteps } from "../src/render/groundSceneBuild";
import { decodeSave } from "../src/save/saveCodec";

// SMOOTH-2R ground scene split: on the live canvas a changed ground is built a few steps a frame within a time budget,
// and the previous scene is shown until the new one is complete. What it finally shows must be exactly the scene the
// synchronous build makes of that state. The big town of the perf gate (1380, 768 people, 86 buildings).

const BIG_TOWN = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/perf-gate/ch4-1380.save.json.gz")))).envelope.state as unknown as GameState;
// The scene as data (as boundaryLayer.test.ts compares it): without its build time and the yard road-distance
// function, which each build makes anew from the same roads.
const timeless = (scene: GroundBoundaryScene) => JSON.parse(JSON.stringify({ ...scene, buildMs: 0 })) as unknown;

/** A road laid on the first grass tiles of a row (a new tiles array, as every road change makes). */
function withRoad(state: GameState, ty: number, count: number): GameState {
  let left = count;
  return { ...state, tiles: state.tiles.map(tile => {
    if (left === 0 || tile.ty !== ty || tile.terrain !== "grass" || tile.hasRoad || tile.buildingId !== null) return tile;
    left -= 1;
    return { ...tile, hasRoad: true };
  }) };
}

/**
 * The stepped build spends a 4 ms budget per frame, read on performance.now(): on the real clock how many frames a
 * build takes depends on the machine and its load (docs/verification/wall-clock-tests.md). Here the clock is a counter that moves
 * 1 ms at each read, so every step costs the same and the frame counts are the same everywhere.
 */
function live(run: () => void): void {
  const realNow = performance.now; let fakeMs = 0;
  performance.now = () => (fakeMs += 1);
  setGroundSceneReverseInput(false); // drops the cached scene
  setGroundSceneZoneDeferral(true); setGroundSceneIncrementalBuild(true);
  try { run(); } finally {
    setGroundSceneZoneDeferral(false); setGroundSceneIncrementalBuild(false); setGroundSceneReverseInput(false);
    performance.now = realNow;
  }
}

/** Frames until the scene is no longer `shown`: the scenes returned on the way and the number of frames. */
function framesUntilNew(state: GameState, shown: GroundBoundaryScene, limit = 200): { readonly scene: GroundBoundaryScene; readonly frames: number } {
  for (let frame = 1; frame <= limit; frame += 1) {
    beginGroundSceneFrame();
    const scene = groundBoundaryScene(state);
    if (scene !== shown) return { scene, frames: frame };
  }
  throw new Error("the scene never changed");
}

test("SMOOTH-2R: the stepped build run at once is the synchronous build", () => {
  const stageMs = new Map<string, number>();
  const stepped = runGroundSceneSteps(groundSceneSteps(BIG_TOWN), stageMs);
  assert.deepEqual(timeless(stepped), timeless(buildGroundBoundaryScene(BIG_TOWN)));
  assert.deepEqual([...stageMs.keys()], ["roads", "forest", "shore", "fields+access", "grounds", "yardProps", "ribbons", "zones", "bounds", "chunks"]);
});

test("SMOOTH-2R: a road change is built over several frames, the old scene shown meanwhile, and ends equal to the synchronous build", (t) => live(() => {
  beginGroundSceneFrame();
  const before = groundBoundaryScene(BIG_TOWN);
  assert.deepEqual(timeless(before), timeless(buildGroundBoundaryScene(BIG_TOWN)), "the first scene is built at once");
  const changed = withRoad(BIG_TOWN, 40, 5);
  const { scene, frames } = framesUntilNew(changed, before);
  const stats = groundBoundarySceneStats();
  t.diagnostic(`${frames} frames, ${stats.lastBuildMs?.toFixed(1)} ms of steps; stages ${JSON.stringify(Object.fromEntries(Object.entries(stats.lastStageMs).map(([k, v]) => [k, Math.round(v * 10) / 10])))}`);
  assert.ok(frames > 1, "spread over frames");
  assert.equal(stats.lastBuildFrames, frames);
  assert.equal(stats.building, false);
  assert.deepEqual(timeless(scene), timeless(buildGroundBoundaryScene(changed)));
  beginGroundSceneFrame();
  assert.equal(groundBoundaryScene(changed), scene, "then kept");
}));

test("SMOOTH-2R: a change during a build lets that build finish, then builds the newest state; both equal the synchronous builds", () => live(() => {
  beginGroundSceneFrame();
  const before = groundBoundaryScene(BIG_TOWN);
  const first = withRoad(BIG_TOWN, 40, 5);
  const second = { ...first, buildings: first.buildings.slice(1) };
  beginGroundSceneFrame();
  assert.equal(groundBoundaryScene(first), before, "the build of `first` starts");
  const middle = framesUntilNew(second, before);
  assert.deepEqual(timeless(middle.scene), timeless(buildGroundBoundaryScene(first)), "the build in progress finishes first");
  const end = framesUntilNew(second, middle.scene);
  assert.deepEqual(timeless(end.scene), timeless(buildGroundBoundaryScene(second)));
}));

test("SMOOTH-2R: a zone-only edit waits a frame (C1d), then rebuilds only the zone part in steps, equal to the synchronous zone rebuild", () => live(() => {
  beginGroundSceneFrame();
  const before = groundBoundaryScene(BIG_TOWN);
  assert.ok((BIG_TOWN.zones ?? []).length > 1);
  const zoned = { ...BIG_TOWN, zones: (BIG_TOWN.zones ?? []).slice(1) };
  const { scene, frames } = framesUntilNew(zoned, before);
  assert.ok(frames >= 2, "the deferral frame, then the build");
  assert.equal(scene.roads, before.roads, "the ground is reused");
  assert.deepEqual(timeless(scene), timeless(buildGroundBoundaryScene(zoned, false, before)));
}));

test("SMOOTH-2R: a state back to the shown scene's drops the build; with the flag off a change is built at once", () => {
  live(() => {
    beginGroundSceneFrame();
    const before = groundBoundaryScene(BIG_TOWN);
    beginGroundSceneFrame();
    assert.equal(groundBoundaryScene(withRoad(BIG_TOWN, 40, 5)), before);
    assert.equal(groundBoundarySceneStats().building, true);
    beginGroundSceneFrame();
    assert.equal(groundBoundaryScene(BIG_TOWN), before);
    assert.equal(groundBoundarySceneStats().building, false);
  });
  const changed = withRoad(BIG_TOWN, 40, 5);
  groundBoundaryScene(BIG_TOWN);
  assert.deepEqual(timeless(groundBoundaryScene(changed)), timeless(buildGroundBoundaryScene(changed)));
});

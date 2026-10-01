/**
 * SMOOTH-2E (spec docs/design/engine-frame-budget.md FB-1…FB-4): the engine's share of a smooth frame — the ticks of a
 * frame held to a budget (tests/gameTickLoopStore.test.ts), the save written in idle slices to the same bytes and kept
 * out of the season turn's second, and the road searches answering as before without their per-step garbage.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { marketRoadDistanceMap } from "../src/engine/marketService";
import { advanceTick } from "../src/engine/tick";
import { AUTOSAVE_SEASON_GAP_MS, autosaveDelayMs, seasonTurned } from "../src/save/autosavePolicy";
import { decodeSave, encodeSave, encodeSaveInPieces } from "../src/save/saveCodec";
import { createSaveService } from "../src/save/saveService";
import { MemorySaveStorage } from "../src/save/saveStorage";
import { canTraverseRoadBoundary } from "../src/world/bridges";
import { getTile, type TileCoordinate } from "../src/world/grid";
import { findExistingRoadPath, getOrthogonalRoadNeighbors, shortestExistingRoadPath } from "../src/world/roadGraph";
import type { WallGrid } from "../src/world/wallTraversal";

const FIXTURES = "fixtures/saves/v32";
const fixture = (name: string) => decodeSave(new Uint8Array(readFileSync(`${FIXTURES}/${name}`))).envelope.state as GameState;
const towns = () => readdirSync(FIXTURES).filter(name => name.endsWith(".save.json")).map(name => [name, fixture(name)] as const);

function drain<T>(steps: Generator<void, T, void>): { value: T; pieces: number } {
  let pieces = 0;
  for (let step = steps.next(); ; step = steps.next(), pieces += 1) if (step.done === true) return { value: step.value, pieces };
}

test("FB-2 the save written in pieces is the whole save byte for byte, checksum and all — every fixture town, and JSON's corner cases", () => {
  for (const [name, state] of towns()) {
    const input = { state, createdAt: "2026-09-29T00:00:00.000Z", savedAt: "2026-09-29T01:00:00.000Z" };
    const whole = encodeSave(input);
    const { value: pieced, pieces } = drain(encodeSaveInPieces(input));
    assert.deepEqual(pieced.header, whole.header, name);
    assert.ok(Buffer.from(pieced.bytes).equals(Buffer.from(whole.bytes)), `${name}: the same bytes`);
    assert.ok(pieces >= 10, `${name}: written in ${pieces} pieces`);
    assert.deepEqual(decodeSave(pieced.bytes).envelope.state, decodeSave(whole.bytes).envelope.state);
  }
  // Skipped undefined members, an array's undefined and non-finite numbers as null, long arrays and deep objects.
  const odd = { ...fixture("new-game.save.json"), extra: { gone: undefined, list: [1, undefined, Number.NaN, { a: [..."x".repeat(300)] }],
    deep: { a: { b: { c: { d: Array.from({ length: 200 }, (_, i) => ({ i, s: `"${i}"` })) } } } }, fn: () => 1 } } as unknown as GameState;
  const input = { state: odd, createdAt: "a", savedAt: "b" };
  assert.ok(Buffer.from(drain(encodeSaveInPieces(input)).value.bytes).equals(Buffer.from(encodeSave(input).bytes)));
});

test("FB-2 a paced autosave writes the same file as one written in a single task, a slice at a time", async () => {
  const state = fixture("chapter-five-town.save.json");
  const at = () => new Date("2026-09-29T00:00:00.000Z");
  const whole = new MemorySaveStorage();
  const sliced = new MemorySaveStorage();
  await createSaveService({ storage: whole, now: at }).autosave(state);
  let paces = 0;
  // The slices are cut on performance.now() (SAVE_SLICE_MS): on the real clock a fast machine may write the save in one
  // slice and a loaded one in many. A counter that moves 1 ms at each read makes the slicing the same everywhere
  // (docs/verification/wall-clock-tests.md).
  const realNow = performance.now; let fakeMs = 0; performance.now = () => (fakeMs += 1);
  let result: Awaited<ReturnType<ReturnType<typeof createSaveService>["autosave"]>>;
  try { result = await createSaveService({ storage: sliced, now: at }).autosave(state, async () => { paces += 1; }); } finally { performance.now = realNow; }
  assert.ok(Buffer.from((await sliced.read(result.meta.slotId))!).equals(Buffer.from((await whole.read("auto-1"))!)));
  assert.ok(paces >= 1 && result.longestSliceMs !== undefined, `${paces} slices, the longest ${result.longestSliceMs} ms`);
});

test("FB-3 a save waits out the second after a season turns; a manual save and the hidden tab's do not", () => {
  const winterEnd = 4000 * 20 - 1;
  assert.equal(seasonTurned({ tick: winterEnd }, { tick: winterEnd + 1 }), true);
  assert.equal(seasonTurned({ tick: winterEnd - 5 }, { tick: winterEnd }), false);
  assert.equal(seasonTurned({ tick: 999 }, { tick: 1003 }), true, "a frame's several ticks across the turn");
  assert.equal(autosaveDelayMs("pause", 10_000, 10_500), AUTOSAVE_SEASON_GAP_MS - 500);
  assert.equal(autosaveDelayMs("interval", 10_000, 10_000 + AUTOSAVE_SEASON_GAP_MS + 1), 0);
  assert.equal(autosaveDelayMs("era_changed", null, 10_000), 0, "no season has turned this session");
  assert.equal(autosaveDelayMs("manual", 10_000, 10_100), 0);
  assert.equal(autosaveDelayMs("hidden", 10_000, 10_100), 0);
});

// The road search as it was before SMOOTH-2E: string keys, a Map of parents, fresh neighbours at every step.
function referencePath(grid: WallGrid, start: TileCoordinate, destination: TileCoordinate): readonly TileCoordinate[] | null {
  const key = (tile: TileCoordinate) => `${tile.tx},${tile.ty}`;
  const road = (tile: TileCoordinate) => getTile(grid, tile)?.hasRoad === true && canTraverseRoadBoundary(grid, tile, tile);
  const neighbours = (tile: TileCoordinate) => [{ tx: tile.tx, ty: tile.ty - 1 }, { tx: tile.tx + 1, ty: tile.ty }, { tx: tile.tx, ty: tile.ty + 1 },
    { tx: tile.tx - 1, ty: tile.ty }].filter(next => getTile(grid, next)?.hasRoad === true && canTraverseRoadBoundary(grid, tile, next));
  if (!road(start) || !road(destination)) return null;
  const frontier = [start];
  const parents = new Map<string, TileCoordinate | null>([[key(start), null]]);
  for (let at = 0; at < frontier.length; at += 1) {
    const current = frontier[at]!;
    if (key(current) === key(destination)) {
      const path: TileCoordinate[] = [];
      for (let tile: TileCoordinate | null = destination; tile !== null; tile = key(tile) === key(start) ? null : parents.get(key(tile))!) path.push(tile);
      return path.reverse();
    }
    for (const next of neighbours(current)) if (!parents.has(key(next))) { parents.set(key(next), current); frontier.push(next); }
  }
  return null;
}

test("FB-4 the road searches answer as the old search did — every path tile for tile, the shortest of many first among equals, the neighbours in order", () => {
  for (const name of ["chapter-five-town.save.json", "palisade-construction.save.json", "population-176.save.json"]) {
    const town = fixture(name);
    const roads = town.tiles.filter(tile => tile.hasRoad).map(tile => ({ tx: tile.tx, ty: tile.ty }));
    assert.ok(roads.length > 20, name);
    const pick = (i: number) => roads[(i * 7919) % roads.length]!;
    for (let i = 0; i < 60; i += 1) {
      const start = pick(i), destination = pick(i * 31 + 5);
      assert.deepEqual(findExistingRoadPath(town, { start, destination }), referencePath(town, start, destination), `${name} ${i}`);
      const path = findExistingRoadPath(town, { start, destination });
      if (path !== null) assert.ok(path[0] === start && path.at(-1) === destination, "its ends are the caller's own objects");
    }
    for (let i = 0; i < 30; i += 1) {
      const starts = [pick(i), pick(i + 11)], destinations = [pick(i * 3 + 1), pick(i * 5 + 2), pick(i * 13 + 3), { tx: -1, ty: 0 }];
      let best: readonly TileCoordinate[] | null = null;
      for (const start of starts) for (const destination of destinations) {
        const path = referencePath(town, start, destination);
        if (path !== null && (best === null || path.length < best.length)) best = path;
      }
      assert.deepEqual(shortestExistingRoadPath(town, starts, destinations), best, `${name} shortest ${i}`);
    }
    for (const tile of roads.slice(0, 80)) {
      const expected = [{ tx: tile.tx, ty: tile.ty - 1 }, { tx: tile.tx + 1, ty: tile.ty }, { tx: tile.tx, ty: tile.ty + 1 }, { tx: tile.tx - 1, ty: tile.ty }]
        .filter(next => getTile(town, next)?.hasRoad === true && canTraverseRoadBoundary(town, tile, next));
      assert.deepEqual(getOrthogonalRoadNeighbors(town, tile), expected);
    }
  }
});

test("FB-4 a market's road distances and a building's road accesses carry over ticks that leave the tiles and the wall, and are made anew when a road changes", () => {
  const town = fixture("chapter-five-town.save.json");
  const market = town.buildings.find(building => building.kind === "market");
  assert.ok(market !== undefined);
  const next = advanceTick(town);
  assert.equal(next.tiles, town.tiles, "a quiet tick keeps the tile array");
  assert.equal(marketRoadDistanceMap(next, market), marketRoadDistanceMap(town, market), "the next tick's state reads the same map");
  assert.equal(buildingRoadAccessTiles(next, market), buildingRoadAccessTiles(town, market));
  const road = town.tiles.findIndex(tile => tile.hasRoad);
  const cut = { ...town, tiles: town.tiles.map((tile, index) => index === road ? { ...tile, hasRoad: false } : tile) };
  assert.notEqual(marketRoadDistanceMap(cut, market), marketRoadDistanceMap(town, market));
  assert.equal(marketRoadDistanceMap(cut, market).has(`${town.tiles[road]!.tx},${town.tiles[road]!.ty}`), false);
});

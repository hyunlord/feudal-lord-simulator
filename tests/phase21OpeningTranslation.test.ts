import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { buildWorldGrid } from "../src/world/terrain";
import { createGrowthInitialState } from "../scripts/phase19GrowthRunControl";

test("approved verification seeds receive a rigid legal opening without changing raw terrain or economic fields", () => {
  const original = structuredClone(DEFAULT_GAME_STATE);
  for (const seed of [1, 2, 3, 4, 5]) {
    const state = createGrowthInitialState(seed);
    const raw = buildWorldGrid({ width: 64, height: 64, seed });
    assert.deepEqual(state.tiles.map(({ buildingId, hasRoad, ...tile }) => tile), raw.tiles.map(({ buildingId, hasRoad, ...tile }) => tile));
    const first = state.buildings[0]; const before = original.buildings[0];
    assert.ok(first && before);
    const dx = first.tx - before.tx; const dy = first.ty - before.ty;
    assert.deepEqual(state.buildings.map(b => ({ ...b, tx: b.tx - dx, ty: b.ty - dy })), original.buildings);
    assert.equal(state.tiles.filter(t => t.hasRoad).length, original.tiles.filter(t => t.hasRoad).length);
    assert.deepEqual(state.tiles.filter(t => t.hasRoad).map(t => [t.tx - dx, t.ty - dy]), original.tiles.filter(t => t.hasRoad).map(t => [t.tx, t.ty]));
    const { tiles, buildings, seed: actualSeed, ...rest } = state;
    const { tiles: originalTiles, buildings: originalBuildings, seed: originalSeed, ...originalRest } = original;
    assert.deepEqual(rest, originalRest);
    assert.deepEqual(createGrowthInitialState(seed), state);
  }
  assert.deepEqual(createGrowthInitialState(1), original);
  assert.deepEqual(DEFAULT_GAME_STATE, original);
});

test("nearest legal offset resolves equal distances by dy then dx", async () => {
  const { selectGrowthOpening } = await import("../scripts/phase21OpeningTranslation");
  const raw = buildWorldGrid({ width: 64, height: 64, seed: 1 });
  const forest = raw.tiles.map(tile => ({ ...tile, terrain: "forest" as const }));
  const blockedCamp = { ...raw, tiles: forest.map(tile => tile.tx === 50 && tile.ty === 40 ? { ...tile, terrain: "water" as const } : tile) };
  const camp = selectGrowthOpening(blockedCamp, 1);
  assert.deepEqual(camp.provenance.offset, { tx: -1, ty: 0 });
  const blockedGranary = { ...raw, tiles: forest.map(tile => tile.tx === 42 && tile.ty === 37 ? { ...tile, terrain: "water" as const } : tile) };
  assert.deepEqual(selectGrowthOpening(blockedGranary, 1).provenance.offset, { tx: 1, ty: 0 });
});

test("no-fit maps fail closed without terrain clearing or a fallback opening", async () => {
  const { selectGrowthOpening, InvalidGrowthOpeningError } = await import("../scripts/phase21OpeningTranslation");
  const raw = buildWorldGrid({ width: 64, height: 64, seed: 1 });
  const water = { ...raw, tiles: raw.tiles.map(tile => ({ ...tile, terrain: "water" as const })) };
  const before = structuredClone(water);
  assert.throws(() => selectGrowthOpening(water, 2), InvalidGrowthOpeningError);
  assert.deepEqual(water, before);
});

test("footprint occupancy is restamped exactly once with no old-position ghosts", async () => {
  const { BUILDING_CONFIG_BY_KIND } = await import("../src/content/buildingConfig");
  for (const seed of [2, 3, 4, 5]) {
    const state = createGrowthInitialState(seed);
    const occupied = new Map<string, string>();
    for (const building of state.buildings) {
      const d = BUILDING_CONFIG_BY_KIND[building.kind];
      for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) occupied.set(`${building.tx + x},${building.ty + y}`, building.id);
    }
    assert.equal(state.tiles.filter(tile => tile.buildingId !== null).length, occupied.size);
    for (const tile of state.tiles) assert.equal(tile.buildingId, occupied.get(`${tile.tx},${tile.ty}`) ?? null);
  }
});

test("CLI refuses a reused evidence directory without replacing its prior summary", async () => {
  const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const out = mkdtempSync(join(tmpdir(), "growth-evidence-"));
  try {
    writeFileSync(join(out, "summary.json"), "existing evidence");
    const run = spawnSync(process.execPath, ["--import", "tsx", resolve("scripts/phase19NaturalGrowth.ts"), "24", "1", out, "2"], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /empty output directory/);
    assert.equal(readFileSync(join(out, "summary.json"), "utf8"), "existing evidence");
  } finally { rmSync(out, { recursive: true }); }
});

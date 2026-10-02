/**
 * NAT-5 (Wave 42): a felled forest cell draws the engine's stage of its tree (treeStage: stump two years, saplings to
 * five, then grown) in place of its trees, until the engine drops the record; the screen's own recovery clock is gone.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { GROWN_YEARS, STUMP_YEARS } from "../src/content/landConfig";
import { buildObjectRenderItems, forestHarvestAgeSignature } from "../src/render/objectRenderOrder";
import { forestHarvestLookup, stumpRenderItemForTile } from "../src/render/stumpRenderItems";
import type { Tile } from "../src/world/world.types";

const YEAR = 4_000;
const tile: Tile = { tx: 4, ty: 4, terrain: "forest", hasRoad: false, buildingId: null };
const harvest = { tx: 4, ty: 4, harvestedAtTick: 100 };
const range = { minTx: 0, maxTx: 10, minTy: 0, maxTy: 10 };
const pictureAt = (tick: number, record = harvest) => {
  const item = stumpRenderItemForTile({ ...tile, tx: record.tx, ty: record.ty }, forestHarvestLookup([record]), new Set(), tick);
  return item?.kind === "land_stage" ? item.piece.picture : null;
};

test("Given a felled tree When the years pass Then it is a stump, short then tall saplings, then young wood, on the engine's ticks", () => {
  const at = (years: number) => 100 + years * YEAR;
  assert.match(pictureAt(at(0)) ?? "", /^stump_(oak_large|ash_small)_fresh$/);
  assert.match(pictureAt(at(1) - 1) ?? "", /_fresh$/);
  assert.match(pictureAt(at(1)) ?? "", /^stump_(oak_large|ash_small)_mossy$/);
  assert.match(pictureAt(at(STUMP_YEARS) - 1) ?? "", /^stump_/);
  assert.equal(pictureAt(at(STUMP_YEARS)), "sapling_1to3");
  assert.equal(pictureAt(at((STUMP_YEARS + GROWN_YEARS) / 2) - 1), "sapling_1to3");
  assert.equal(pictureAt(at((STUMP_YEARS + GROWN_YEARS) / 2)), "sapling_4to8");
  assert.equal(pictureAt(at(GROWN_YEARS) - 1), "sapling_4to8");
  assert.match(pictureAt(at(GROWN_YEARS)) ?? "", /^young_wood_[ab]$/);
  assert.match(pictureAt(at(40)) ?? "", /^young_wood_[ab]$/, "a grown record kept by a zone stays young wood");
});

test("Given many felled cells Then the stump species and the young wood vary by cell, deterministically", () => {
  const records = Array.from({ length: 64 }, (_, index) => ({ tx: index % 8, ty: Math.floor(index / 8), harvestedAtTick: 100 }));
  const stumps = records.map(record => pictureAt(100, record));
  const woods = records.map(record => pictureAt(100 + GROWN_YEARS * YEAR, record));
  assert.ok(stumps.includes("stump_oak_large_fresh") && stumps.includes("stump_ash_small_fresh"));
  assert.ok(woods.includes("young_wood_a") && woods.includes("young_wood_b"));
  assert.deepEqual(records.map(record => pictureAt(100, record)), stumps);
});

test("Given a felled cell When the record is dropped Then the forest's trees stand again, and the record is never modified", () => {
  const harvests = Object.freeze([Object.freeze(harvest)]);
  const input = { tiles: [tile], buildings: [], range, seed: 73, includeGroundCover: false };
  const felled = buildObjectRenderItems({ ...input, tick: 100 + 30 * YEAR, forestHarvests: harvests });
  const regrown = buildObjectRenderItems({ ...input, tick: 100 + 30 * YEAR, forestHarvests: [] });
  assert.equal(felled.filter(item => item.kind === "land_stage").length, 1);
  assert.equal(felled.filter(item => item.kind === "tree").length, 0);
  assert.equal(regrown.filter(item => item.kind === "land_stage").length, 0);
  assert.ok(regrown.some(item => item.kind === "tree"));
  assert.deepEqual(harvests, [harvest]);
});

test("Given the object queue's cache key Then the felled trees' signature moves exactly when a picture changes", () => {
  const records = Array.from({ length: 64 }, (_, index) => ({ tx: index % 8, ty: Math.floor(index / 8), harvestedAtTick: 100 + index * 10 }));
  const signature = (tick: number) => forestHarvestAgeSignature(records, tick);
  assert.equal(signature(200), signature(1_000), "no picture turns inside the first year");
  assert.notEqual(signature(200), signature(100 + YEAR), "the first stump turns mossy");
  assert.equal(signature(100 + 64 * 10 + YEAR), signature(100 + 2 * YEAR - 1), "all mossy until the first saplings");
  assert.notEqual(signature(100 + 2 * YEAR - 1), signature(100 + 2 * YEAR));
  assert.notEqual(forestHarvestAgeSignature([...records], 200), forestHarvestAgeSignature(records.slice(1), 200), "a dropped record moves it");
});

test("Given a road, a building, water, grass, rock or a cleared yard Then a felled record draws nothing there", () => {
  const variants: readonly Tile[] = [{ ...tile, hasRoad: true }, { ...tile, buildingId: "home" }, { ...tile, terrain: "water" }, { ...tile, terrain: "grass" }, { ...tile, terrain: "rock" }];
  for (const blocked of variants) {
    for (const tick of [100, 30 * YEAR]) {
      const items = buildObjectRenderItems({ tiles: [blocked], buildings: [], range, tick, forestHarvests: [harvest], includeGroundCover: false });
      assert.equal(items.filter(item => item.kind === "tree" || item.kind === "land_stage").length, 0);
    }
  }
  assert.equal(stumpRenderItemForTile(tile, forestHarvestLookup([harvest]), new Set(["4:4"]), 100), null);
});

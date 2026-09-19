import assert from "node:assert/strict";
import test from "node:test";
import { buildStumpDescriptor } from "../src/render/treeLayout";
import { buildObjectRenderItems, forestHarvestAgeSignature } from "../src/render/objectRenderOrder";
import { forestHarvestLookup, stumpRenderItemForTile } from "../src/render/stumpRenderItems";
import { TILE_H, TILE_W, tileToScreen } from "../src/render/iso";
import type { Tile } from "../src/world/world.types";

const tile: Tile = { tx: 4, ty: 4, terrain: "forest", hasRoad: false, buildingId: null };
const harvest = { tx: 4, ty: 4, harvestedAtTick: 100 };
const range = { minTx: 0, maxTx: 10, minTy: 0, maxTy: 10 };

test("stump anchors and size vary deterministically without leaving their tile diamond", () => {
  // Given
  const harvests = Array.from({ length: 64 }, (_, index) => ({ tx: index % 8, ty: Math.floor(index / 8), harvestedAtTick: 100 }));
  // When
  const stumps = harvests.map((harvest) => buildStumpDescriptor({ harvest, tick: 100 }));
  // Then
  assert.ok(new Set(stumps.map((stump) => stump.scale)).size > 8);
  for (const [index, stump] of stumps.entries()) {
    const source = harvests[index];
    assert.ok(source);
    const center = tileToScreen(source.tx, source.ty);
    assert.ok(Math.abs(stump.x - center.sx) / (TILE_W / 2) + Math.abs(stump.y - center.sy) / (TILE_H / 2) <= 0.7);
    assert.deepEqual(stump, buildStumpDescriptor({ harvest: source, tick: 101 }));
  }
});

test("long harvested forest recovers trees without modifying harvest history", () => {
  // Given
  const harvests = Object.freeze([Object.freeze(harvest)]);
  const input = { tiles: [tile], buildings: [], range, seed: 73, forestHarvests: harvests, includeGroundCover: false };
  // When
  const fresh = buildObjectRenderItems({ ...input, tick: 100 });
  const recovered = buildObjectRenderItems({ ...input, tick: 10_000 });
  // Then
  assert.equal(fresh.filter((item) => item.kind === "stump").length, 1);
  assert.equal(recovered.filter((item) => item.kind === "stump").length, 0);
  assert.ok(recovered.some((item) => item.kind === "tree"));
  assert.deepEqual(harvests, [harvest]);
});

test("recovery is staggered over the forest and participates in the render cache signature", () => {
  // Given
  const harvests = Array.from({ length: 64 }, (_, index) => ({ tx: index % 8, ty: Math.floor(index / 8), harvestedAtTick: 100 }));
  const lookup = forestHarvestLookup(harvests);
  // When
  const count = (tick: number): number => harvests.filter((harvest) => stumpRenderItemForTile({ ...tile, tx: harvest.tx, ty: harvest.ty }, lookup, new Set(), tick) !== null).length;
  // Then
  assert.equal(count(100), 64);
  assert.ok(count(5_500) > 0 && count(5_500) < 64);
  assert.equal(count(10_000), 0);
  assert.notEqual(forestHarvestAgeSignature(harvests, 800), forestHarvestAgeSignature(harvests, 10_000));
});

test("stumps and recovered trees never reclaim occupied roads or nonforest terrain", () => {
  // Given
  const variants: readonly Tile[] = [{ ...tile, hasRoad: true }, { ...tile, buildingId: "home" }, { ...tile, terrain: "water" }, { ...tile, terrain: "grass" }, { ...tile, terrain: "rock" }];
  // When / Then
  for (const blocked of variants) {
    for (const tick of [100, 10_000]) {
      const items = buildObjectRenderItems({ tiles: [blocked], buildings: [], range, tick, forestHarvests: [harvest], includeGroundCover: false });
      assert.equal(items.filter((item) => item.kind === "tree" || item.kind === "stump").length, 0);
    }
  }
  assert.equal(stumpRenderItemForTile(tile, forestHarvestLookup([harvest]), new Set(["4:4"]), 100), null);
});

test("weathered stumps shrink while their deterministic ground anchors remain fixed", () => {
  // Given
  const fresh = buildStumpDescriptor({ harvest, tick: 100 });
  const old = buildStumpDescriptor({ harvest, tick: 700 });
  // When
  const weathered = buildStumpDescriptor({ harvest, tick: 1_900 });
  // Then
  assert.ok(weathered.scale < old.scale && old.scale < fresh.scale);
  assert.equal(weathered.x, fresh.x);
  assert.equal(weathered.y, fresh.y);
  assert.equal(weathered.spriteKey, "stump_old");
});

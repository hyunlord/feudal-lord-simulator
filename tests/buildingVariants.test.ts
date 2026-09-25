import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { BUILDING_VARIANT_POOLS } from "../src/render/buildingVariantManifest";
import { BUILDING_VARIANT_OVERLAY_REGISTRATION } from "../src/render/buildingVariantOverlay.generated";
import { buildingVariantAssignments, rawVariant, variantPool } from "../src/render/buildingVariants";
import type { PalisadeProtectionSource } from "../src/geometry/palisadeProtection";
import { HOUSE_CONDITION_ART } from "../src/render/houseConditionArt.generated";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { seedGroundState } from "../scripts/boundaryFixtureStates";
import { variantDistribution } from "../scripts/variantDistribution";

const assignmentIds = (state: Pick<GameState, "seed" | "buildings" | "houses">) =>
  [...buildingVariantAssignments(state)].map(([id, value]) => `${id}=${value.variant.id}`).sort();

function variantImages(): { readonly pool: string; readonly url: string }[] {
  return BUILDING_VARIANT_POOLS.flatMap(pool => pool.variants.flatMap(variant => {
    const images = [variant, ...("quiet" in variant ? [variant.quiet] : [])];
    return images.flatMap(image => image.url === null ? [] : [{ pool: pool.pool, url: image.url }]);
  }));
}

test("Given the Wave 2 manifest When its images are listed Then the 28 installed files are used and the pastoral hold and retired mixed farm sets are not", () => {
  // 32 installed by V1; the four mixed-farm paintings were retired with the wheat farm (C1f, assets-inbox/retired).
  const images = variantImages().filter(image => image.url.includes("/variants-wave2/"));
  assert.equal(images.length, 28);
  assert.equal(new Set(images.map(image => image.url)).size, 28);
  assert.ok(variantImages().every(image => !image.url.includes("farm_mixed")));
  for (const image of images) assert.ok(existsSync(new URL(`../public/${image.url}`, import.meta.url)), image.url);
  assert.ok(images.every(image => !image.url.includes("pastoral") && !image.url.includes("thatch")));
  for (const pool of BUILDING_VARIANT_POOLS) {
    assert.ok(pool.pool.startsWith("building:"), "namespace:id");
    // Weight 0 = a state image, never picked by the variant rule (C1f: the farmstead's harvest art).
    assert.ok(pool.variants.every(variant => variant.weight > 0 || (pool.kind === "farmstead" && (variant.id === "working" || variant.id === "winter"))), pool.pool);
  }
});

test("Given every house variant When overlay registration is looked up Then each has one and its body has all three condition layers", () => {
  const houseImages = variantImages().filter(image => BUILDING_VARIANT_POOLS.find(pool => pool.pool === image.pool)?.kind === "house");
  assert.equal(houseImages.length, 18);
  for (const image of houseImages) {
    const registration = BUILDING_VARIANT_OVERLAY_REGISTRATION.find(entry => entry.url === image.url);
    assert.ok(registration !== undefined, image.url);
    assert.ok(registration.scale >= 0.7 && registration.scale <= 1.1, image.url);
    const pool = BUILDING_VARIANT_POOLS.find(candidate => candidate.pool === image.pool);
    assert.ok(pool !== undefined && "level" in pool);
    const layers = HOUSE_CONDITION_ART.filter(art => art.level === pool.level && art.lot === pool.lot);
    assert.deepEqual(layers.map(art => art.condition).sort(), ["neglected", "strained", "vacant"], image.url);
  }
});

test("Given the same state When variants are chosen twice, from reversed building order, and after save and load Then every building keeps its variant", () => {
  for (const seed of [2, 3] as const) {
    // Given
    const state = seedGroundState(seed);

    // When
    const first = assignmentIds(state);
    const reversed = assignmentIds({ ...state, buildings: [...state.buildings].reverse(), houses: [...state.houses].reverse() });
    const loaded = decodeSave(encodeSave({ state, createdAt: "2026-09-24T00:00:00.000Z", savedAt: "2026-09-24T00:00:00.000Z" }).bytes).envelope.state;

    // Then
    assert.ok(first.length > 40);
    assert.deepEqual(assignmentIds(state), first);
    assert.deepEqual(reversed, first);
    assert.deepEqual(assignmentIds(loaded), first);
  }
});

test("Given the seed 2 and 3 towns When variants are counted Then no grade leans past 70% and at most 40% of touching pairs match", () => {
  for (const seed of [2, 3] as const) {
    const result = variantDistribution(seedGroundState(seed));
    for (const pool of result.pools.filter(candidate => candidate.pool.startsWith("building:house_") || candidate.count >= 4)) {
      assert.ok(pool.topShare <= 0.7, `seed ${seed} ${pool.pool} ${JSON.stringify(pool.byVariant)}`);
    }
    assert.ok(result.adjacentSameShare <= 0.4, `seed ${seed} ${result.adjacentSame}/${result.adjacentPairs}`);
  }
});

const house = (tx: number, ty: number, houseLot?: "horizontal" | "vertical"): Building => ({
  id: `house-${tx}-${ty}`, kind: "house", tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0,
  ...(houseLot === undefined ? {} : { houseLot }),
});

test("Given a house that rises a grade When its variant is re-picked Then it stays in the new grade's pool and often keeps its family", () => {
  let kept = 0; let comparable = 0;
  for (let tx = 0; tx < 60; tx += 1) for (let ty = 0; ty < 10; ty += 1) {
    const building = house(tx, ty);
    for (const level of [1, 2]) {
      const before = rawVariant(7, building, level - 1); const after = rawVariant(7, building, level);
      assert.ok(after !== null && variantPool(building, level)?.variants.some(variant => variant.id === after.id));
      if (before === null || before.family === "base" || !variantPool(building, level)?.variants.some(variant => variant.family === before.family)) continue;
      comparable += 1;
      if (after?.family === before.family) kept += 1;
    }
  }
  // Half keep the family by rule; the other half re-pick uniformly and sometimes land on it anyway.
  assert.ok(kept / comparable > 0.5 && kept / comparable < 0.9, `${kept}/${comparable}`);
});

test("Given a house that declines and recovers or a lot that is merged and split When variants are chosen Then the variant follows grade and lot only", () => {
  // Given
  const single = house(10, 10);
  const houses = (level: number, livingLevel: number) => [{ buildingId: single.id, level: livingLevel, builtLevel: level, residents: 2 }] as unknown as GameState["houses"];
  const base = { seed: 4, buildings: [single] };

  // When
  const maintained = buildingVariantAssignments({ ...base, houses: houses(2, 2) }).get(single.id)?.variant.id;
  const declined = buildingVariantAssignments({ ...base, houses: houses(2, 0) }).get(single.id)?.variant.id;
  const beforeMerge = buildingVariantAssignments({ ...base, houses: houses(3, 3) }).get(single.id);
  const merged = buildingVariantAssignments({ seed: 4, buildings: [house(10, 10, "horizontal")], houses: houses(3, 3) }).get(single.id);
  const split = buildingVariantAssignments({ ...base, houses: houses(3, 3) }).get(single.id);

  // Then
  assert.equal(declined, maintained);
  assert.equal(merged?.pool, "building:house_pair_l3_horizontal", "a merged lot picks from the pair pool");
  assert.equal(beforeMerge?.pool, "building:house_l3");
  assert.equal(split?.variant.id, beforeMerge?.variant.id, "splitting returns to the single seed");
});

test("Given L1 houses When the wall is missing, unfinished, or around them Then the tile-roof variant appears only inside a finished wall", () => {
  // Given: a square wall from (0,0) to (40,40); houses at (10..29, 10..29) are inside, (50..69, 10..29) outside.
  const polygon = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }, { x: 0, y: 0 }];
  const wall = (completed: boolean): PalisadeProtectionSource => ({ polygon, segments: [{ completed }, { completed: true }] });
  const count = (xs: readonly number[], palisade: PalisadeProtectionSource) => {
    let tile = 0; let total = 0;
    for (const tx of xs) for (let ty = 10; ty < 30; ty += 1) { total += 1; if (rawVariant(3, house(tx, ty), 1, palisade)?.id === "tile") tile += 1; }
    return { tile, total };
  };
  const inside = Array.from({ length: 20 }, (_, index) => 10 + index);
  const outside = Array.from({ length: 20 }, (_, index) => 50 + index);

  // When / Then
  assert.equal(count(inside, null).tile, 0, "no wall: never");
  assert.equal(count(inside, wall(false)).tile, 0, "unfinished wall: never");
  assert.equal(count(outside, wall(true)).tile, 0, "outside a finished wall: never");
  const walled = count(inside, wall(true));
  assert.ok(walled.tile / walled.total > 0.12 && walled.tile / walled.total < 0.4, `inside: ${walled.tile}/${walled.total}`);
  assert.equal(count(inside, wall(true)).tile, walled.tile, "deterministic");
});

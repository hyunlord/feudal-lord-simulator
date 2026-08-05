import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PALETTE, RAMPS } from "../src/content/palette";
import {
  BUILDING_SPRITE_CONTRACTS,
  FOLIAGE_SPRITE_CONTRACTS,
  assertBuildingRoofPolicy,
  assertGroundCoverSilhouette,
  assertHouseHeightProgression,
  assertSpriteContract,
  assertWheatFieldDominance,
  enforceBuildingMaterialPolicy,
  enforceFoliageMaterialPolicy,
  enforceWorldMaterialPolicy,
  processWorldSprite,
  worldSpriteContract,
  type WorldSpriteKey,
} from "../scripts/worldSpritePipeline";
import { OUTLINE_ALPHA, findOpaqueBounds, type RgbaImage } from "../scripts/processBuildingSprite";

const rgb = (hex: string): readonly [number, number, number] => {
  const parsed = Number.parseInt(hex.slice(1), 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
};

const image = (width: number, height: number): RgbaImage => ({
  dimensions: { width, height },
  rgba: new Uint8Array(width * height * 4),
});

const setPixel = (
  target: RgbaImage,
  x: number,
  y: number,
  colour: readonly [number, number, number, number],
): void => {
  const index = (y * target.dimensions.width + x) * 4;
  target.rgba.set(colour, index);
};

const fill = (
  target: RgbaImage,
  left: number,
  top: number,
  right: number,
  bottom: number,
  colour: readonly [number, number, number, number],
): void => {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) setPixel(target, x, y, colour);
  }
};

const contractImage = (key: WorldSpriteKey, visibleWidth: number): RgbaImage => {
  const contract = worldSpriteContract(key);
  const target = image(contract.width, contract.height);
  const left = Math.floor((contract.width - visibleWidth) / 2);
  fill(
    target,
    left,
    contract.baselineY - 12,
    left + visibleWidth,
    Math.min(contract.height, contract.baselineY + 1),
    [...rgb(RAMPS.earth[2]), 255],
  );
  return enforceWorldMaterialPolicy(target, key);
};

describe("worldSpritePipeline", () => {
  it("declares every exact Phase 4C canvas and baseline", () => {
    assert.deepEqual(BUILDING_SPRITE_CONTRACTS, {
      house_l1: { width: 96, height: 120, baselineY: 104, footprint: 1 },
      house_l2: { width: 96, height: 144, baselineY: 128, footprint: 1 },
      house_l3: { width: 160, height: 192, baselineY: 176, footprint: 2 },
      well: { width: 72, height: 80, baselineY: 64, footprint: 1 },
      storehouse: { width: 160, height: 136, baselineY: 120, footprint: 2 },
      wheat_farm: { width: 160, height: 96, baselineY: 80, footprint: 2 },
      logging_camp: { width: 96, height: 104, baselineY: 88, footprint: 1 },
      sawmill: { width: 112, height: 112, baselineY: 96, footprint: 1 },
    });
    assert.deepEqual(FOLIAGE_SPRITE_CONTRACTS, {
      tree_conifer_a: { width: 64, height: 96, baselineY: 96 },
      tree_conifer_b: { width: 56, height: 80, baselineY: 80 },
      tree_broadleaf_a: { width: 72, height: 88, baselineY: 88 },
      tree_broadleaf_b: { width: 64, height: 72, baselineY: 72 },
      shrub_a: { width: 40, height: 28, baselineY: 28 },
      shrub_b: { width: 32, height: 22, baselineY: 22 },
      grass_tuft: { width: 28, height: 18, baselineY: 18 },
      field_stone: { width: 24, height: 16, baselineY: 16 },
    });
  });

  it("enforces one-tile and two-tile visible-width bands", () => {
    assert.doesNotThrow(() => assertSpriteContract(contractImage("house_l1", 64), "house_l1"));
    assert.throws(() => assertSpriteContract(contractImage("house_l1", 63), "house_l1"), /64\.\.90/);
    assert.doesNotThrow(() => assertSpriteContract(contractImage("house_l3", 115), "house_l3"));
    assert.throws(() => assertSpriteContract(contractImage("house_l3", 142), "house_l3"), /115\.\.141/);
  });

  it("requires house alpha-bbox heights to increase from L0 through L3", () => {
    const houses = {
      house_l0: contractImage("house_l1", 64),
      house_l1: contractImage("house_l1", 64),
      house_l2: contractImage("house_l2", 64),
      house_l3: contractImage("house_l3", 115),
    };
    fill(houses.house_l0, 16, 100, 80, 105, [...rgb(RAMPS.thatch[2]), 255]);
    fill(houses.house_l1, 16, 90, 80, 105, [...rgb(RAMPS.thatch[2]), 255]);
    fill(houses.house_l2, 16, 105, 80, 129, [...rgb(RAMPS.slate[2]), 255]);
    fill(houses.house_l3, 22, 140, 137, 177, [...rgb(RAMPS.slate[2]), 255]);
    assert.doesNotThrow(() => assertHouseHeightProgression(houses));
    assert.throws(() => assertHouseHeightProgression({ ...houses, house_l2: houses.house_l1 }), /strictly increase/);
  });

  it("processes a sprite to its exact canvas with a transparent post-baseline margin", () => {
    const source = image(8, 8);
    fill(source, 0, 0, 8, 8, [0, 255, 255, 255]);
    fill(source, 2, 1, 6, 7, [...rgb(RAMPS.plaster[3]), 255]);
    const processed = processWorldSprite(source, "house_l1", (_source, target) => {
      const resized = image(target.width, target.height);
      fill(resized, 0, 0, target.width, target.height, [...rgb(RAMPS.plaster[3]), 255]);
      return resized;
    });
    assert.deepEqual(processed.dimensions, { width: 96, height: 120 });
    for (let y = 105; y < 120; y += 1) {
      for (let x = 0; x < 96; x += 1) assert.equal(processed.rgba[(y * 96 + x) * 4 + 3], 0);
    }
  });

  it("keeps alpha-179 ink only on the exterior upper outline", () => {
    const valid = contractImage("house_l1", 64);
    setPixel(valid, 15, 93, [...rgb(PALETTE.ink), OUTLINE_ALPHA]);
    assert.doesNotThrow(() => assertSpriteContract(valid, "house_l1"));
    setPixel(valid, 15, 101, [...rgb(PALETTE.ink), OUTLINE_ALPHA]);
    assert.throws(() => assertSpriteContract(valid, "house_l1"), /lower third/);
    setPixel(valid, 15, 101, [0, 0, 0, 0]);
    setPixel(valid, 30, 94, [...rgb(PALETTE.ink), OUTLINE_ALPHA]);
    assert.throws(() => assertSpriteContract(valid, "house_l1"), /interior hole/);
  });

  it("makes the worked field dominate wheat-farm visible mass", () => {
    const farm = contractImage("wheat_farm", 115);
    const remapped = enforceBuildingMaterialPolicy(farm, "wheat_farm");
    assert.doesNotThrow(() => assertWheatFieldDominance(remapped));
    fill(remapped, 23, 68, 138, 81, [...rgb(RAMPS.timber[2]), 255]);
    assert.throws(() => assertWheatFieldDominance(remapped), /earth ramp must dominate/);
  });

  it("enforces the declared roof ramp for each building kind", () => {
    const dwelling = contractImage("house_l1", 64);
    fill(dwelling, 16, 92, 80, 98, [...rgb(RAMPS.stone[2]), 255]);
    const remapped = enforceBuildingMaterialPolicy(dwelling, "house_l1");
    assert.doesNotThrow(() => assertBuildingRoofPolicy(remapped, "house_l1"));
    fill(remapped, 16, 92, 80, 98, [...rgb(RAMPS.slate[2]), 255]);
    assert.throws(() => assertBuildingRoofPolicy(remapped, "house_l1"), /thatch roof policy/);
  });

  it("restricts foliage interiors to foliage or timber and reserves ink for its outline", () => {
    const tree = contractImage("tree_conifer_a", 40);
    fill(tree, 12, 72, 52, 89, [...rgb(RAMPS.plaster[2]), 255]);
    const remapped = enforceFoliageMaterialPolicy(tree);
    setPixel(remapped, 11, 74, [...rgb(PALETTE.ink), OUTLINE_ALPHA]);
    assert.doesNotThrow(() => assertSpriteContract(remapped, "tree_conifer_a"));
    setPixel(remapped, 20, 78, [...rgb(PALETTE.ink), 255]);
    assert.throws(() => assertSpriteContract(remapped, "tree_conifer_a"), /foliage or timber interior/);
  });

  it("requires both shrub alpha silhouettes to be wider than tall", () => {
    const wide = contractImage("shrub_a", 30);
    assert.doesNotThrow(() => assertGroundCoverSilhouette(wide, "shrub_a"));
    const tall = image(40, 28);
    fill(tall, 17, 2, 23, 28, [...rgb(RAMPS.foliage[2]), 255]);
    assert.throws(() => assertGroundCoverSilhouette(tall, "shrub_a"), /wider than tall/);
  });

  it("keeps field stones in stone or earth ramps", () => {
    const stone = contractImage("field_stone", 18);
    const processed = enforceWorldMaterialPolicy(stone, "field_stone");
    assert.doesNotThrow(() => assertSpriteContract(processed, "field_stone"));
  });

  it("reports the final opaque bounds used by the contract", () => {
    const sprite = contractImage("sawmill", 90);
    assert.deepEqual(findOpaqueBounds(sprite), { left: 11, top: 84, right: 101, bottom: 97 });
  });
});

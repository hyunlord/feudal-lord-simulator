import assert from "node:assert/strict";
import test from "node:test";
import { farmGrowthStage, farmGroundPoint, farmGroundCenter } from "../src/render/farmGeometry";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { stepProduction } from "../src/economy/production";
import { buildingSpriteOverlapsCursorTile } from "../src/render/occlusionModel";

const farm: Building = { id: "farm", kind: "wheat_farm", tx: 0, ty: 0, workers: 4, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };

test("farm hover follows its four ground tiles regardless of camera and DPR", () => {
  for (const zoom of [0.5, 1, 2]) for (const dpr of [1, 2]) {
    for (let tx = -1; tx <= 2; tx += 1) for (let ty = -1; ty <= 2; ty += 1) {
      assert.equal(buildingSpriteOverlapsCursorTile({ building: farm, houseLevel: 0,
        hoveredTile: { tx, ty }, camera: { zoom, panX: 137, panY: -83 }, dpr }),
      tx >= 0 && tx < 2 && ty >= 0 && ty < 2, `tile ${tx},${ty} at ${zoom}x DPR ${dpr}`);
    }
  }
});

test("farm stages follow actual production quarters including held harvest", () => {
  const inputs = [0, 9, 10, 19, 20, 29, 30, 40];
  const actual = inputs.map(productionProgress => farmGrowthStage({ ...farm, productionProgress }));
  assert.deepEqual(actual, ["worked", "worked", "seedling", "seedling", "growing", "growing", "ripe", "ripe"]);
});

test("harvest resets appearance while blocked production keeps ripe appearance", () => {
  const ready = { ...farm, productionProgress: 39 };
  const harvested = stepProduction(ready, BUILDING_CONFIG_BY_KIND.wheat_farm);
  const blocked = stepProduction({ ...ready, inventory: { wheat: 20 } }, BUILDING_CONFIG_BY_KIND.wheat_farm);
  assert.equal(farmGrowthStage(harvested.building), "worked");
  assert.equal(farmGrowthStage(blocked.building), "ripe");
});

test("unstaffed farm retains its existing growth state without advancing simulation", () => {
  const paused = { ...farm, workers: 0, productionProgress: 25 };
  const actual = stepProduction(paused, BUILDING_CONFIG_BY_KIND.wheat_farm);
  assert.equal(actual.building, paused);
  assert.equal(farmGrowthStage(actual.building), "growing");
});

test("common source ground points map to the exact 2x2 diamond", () => {
  const points = [{ x: 65, y: 530 }, { x: 885, y: 107 }, { x: 1705, y: 530 }, { x: 885, y: 850 }];
  const actual = points.map(farmGroundPoint);
  assert.deepEqual(actual, [{ x: -64, y: 0 }, { x: 0, y: -32 }, { x: 64, y: 0 }, { x: 0, y: 32 }]);
});

test("adjacent farms share whole edges in each grid axis and at map origin", () => {
  const center = farmGroundCenter(farm);
  const east = farmGroundCenter({ tx: 2, ty: 0 });
  const south = farmGroundCenter({ tx: 0, ty: 2 });
  assert.deepEqual(center, { x: 0, y: 16 });
  assert.deepEqual({ x: east.x - 64, y: east.y }, { x: center.x, y: center.y + 32 });
  assert.deepEqual({ x: south.x + 64, y: south.y }, { x: center.x, y: center.y + 32 });
});

test("a negative restored progress remains worked and an overfull progress remains ripe", () => {
  assert.equal(farmGrowthStage({ productionProgress: -1 }), "worked");
  assert.equal(farmGrowthStage({ productionProgress: 80 }), "ripe");
});

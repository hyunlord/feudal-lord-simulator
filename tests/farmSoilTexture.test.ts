import assert from "node:assert/strict";
import test from "node:test";
import { farmMaterialTiles } from "../src/render/farmSoilTexture";
import { farmGroundCenter } from "../src/render/farmGeometry";

test("material tiles cover the entire farm footprint at shared and negative map coordinates", () => {
  for (const tx of [-2, 0, 1, 47, 94]) for (const ty of [-2, 0, 1, 43, 94]) {
    const plot = { tx, ty };
    const center = farmGroundCenter(plot);
    const tiles = farmMaterialTiles(plot);
    assert.ok(tiles.length <= 4);
    for (let dx = -63; dx <= 63; dx += 7) for (let dy = -31; dy <= 31; dy += 7) {
      assert.ok(tiles.some(tile => center.x + dx >= tile.x && center.x + dx < tile.x + tile.width
        && center.y + dy >= tile.y && center.y + dy < tile.y + tile.height));
    }
    for (const tile of tiles) {
      assert.equal(Math.abs(tile.x % 128), 0);
      assert.equal(Math.abs(tile.y % 64), 0);
    }
  }
});

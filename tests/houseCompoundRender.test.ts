import assert from "node:assert/strict";
import test from "node:test";
import type { Building } from "../src/content/buildingConfig";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { buildingContactPolygon, buildingFrontage } from "../src/render/buildingFrontage";
import { groundCoverProtectedTileKeys } from "../src/render/groundCoverProtection";
import { houseCompoundGeometry } from "../src/render/houseCompound";
import { buildObjectRenderItems, clearedTreeTileKeys } from "../src/render/objectRenderOrder";
import { depthKey } from "../src/render/iso";
import { selectWorldAtTile } from "../src/render/worldSelection";
import type { Tile } from "../src/world/world.types";

for (const houseLot of ["horizontal", "vertical"] as const) {
  const building: Building = { id: "pair", kind: "house", tx: 3, ty: 3, houseLot, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  const size = buildingFootprint(building);
  const second = { tx: 3 + size.width - 1, ty: 3 + size.height - 1 };
  const tiles: Tile[] = Array.from({ length: 81 }, (_, i) => { const tx = i % 9; const ty = Math.floor(i / 9); return { tx, ty, terrain: "grass", buildingId: tx >= 3 && tx < 3 + size.width && ty >= 3 && ty < 3 + size.height ? "pair" : null, hasRoad: false }; });
  test(`${houseLot}: rear anchor outside view still renders second half at correct depth`, () => {
    const items = buildObjectRenderItems({ tiles: [], buildings: [building], range: { minTx: second.tx, maxTx: second.tx, minTy: second.ty, maxTy: second.ty } });
    const item = items.find(item => item.kind === "building");
    assert.ok(item); assert.equal(item.depth, depthKey(second.tx, second.ty));
    assert.equal(item.anchorTx, second.tx);
    assert.ok(clearedTreeTileKeys([building]).has(`${second.tx + 1}:${second.ty + 1}`));
    assert.deepEqual(selectWorldAtTile({ width: 9, height: 9, tiles, buildings: [building], constructionSites: [], walkers: [] }, second), { kind: "building", buildingId: "pair" });
  });
  test(`${houseLot}: cached vegetation protection tracks lot changes on same tile array`, () => {
    const { houseLot: ignored, ...single } = building;
    assert.ok(ignored);
    const prior = groundCoverProtectedTileKeys(tiles, [single]);
    const after = groundCoverProtectedTileKeys(tiles, [building]);
    const edge = houseLot === "horizontal" ? "6:3" : "3:6";
    assert.equal(prior.has(edge), false); assert.equal(after.has(edge), true);
  });
  test(`${houseLot}: shared roof, contact and frontage stay on lot and real perimeter roads`, () => {
    for (let level = 0; level <= 4; level += 1) for (const point of houseCompoundGeometry(building, level).corners) {
      assert.ok(point.tx > 2.5 && point.tx < 2.5 + size.width);
      assert.ok(point.ty > 2.5 && point.ty < 2.5 + size.height);
    }
    for (const point of buildingContactPolygon(building)) {
      assert.ok(point.tx > 2.5 && point.tx < 2.5 + size.width);
      assert.ok(point.ty > 2.5 && point.ty < 2.5 + size.height);
    }
    const road = { tx: second.tx, ty: second.ty + 1 };
    const grid = { width: 9, height: 9, tiles: tiles.map(tile => tile.tx === road.tx && tile.ty === road.ty ? { ...tile, hasRoad: true } : tile) };
    const frontage = buildingFrontage(grid, building, 7); assert.ok(frontage);
    assert.ok(frontage.paths.some(path => path.road.tx === road.tx && path.road.ty === road.ty));
    for (const polygon of [frontage.pad, ...frontage.paths.flatMap(path => [path.interior, path.interiorEdge, path.polygon, path.edge])]) for (const point of polygon) {
      const tile = grid.tiles.find(tile => tile.tx === Math.round(point.tx) && tile.ty === Math.round(point.ty));
      assert.ok(tile?.buildingId === building.id || tile?.hasRoad);
    }
    const blocked = { ...grid, tiles: grid.tiles.map(tile => tile.hasRoad ? { ...tile, buildingId: "neighbor" } : tile) };
    assert.equal(buildingFrontage(blocked, building, 7)?.paths.length, 0);
  });
}

test("compound art preserves aspect ratio, anchors both orientations and reserves the complete lot", async () => {
  const { houseCompoundAssetManifest } = await import("../src/render/houseCompoundAssetManifest.generated");
  const { houseCompoundSpriteRect } = await import("../src/render/houseCompoundAssets");
  for (const meta of houseCompoundAssetManifest) {
    const building: Building = { id: "pair", kind: "house", tx: 3, ty: 3, houseLot: meta.axis, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
    const rect = houseCompoundSpriteRect(building, meta);
    assert.equal(rect.width, 84.48);
    assert.ok(Math.abs(rect.width / rect.height - meta.alphaBounds.width / meta.alphaBounds.height) < 1e-9);
    assert.equal(rect.y + rect.height, 120);
    assert.equal(rect.x + rect.width / 2, meta.axis === "horizontal" ? 16 : -16);
    assert.ok(meta.alphaBounds.x >= 0 && meta.alphaBounds.y >= 0);
    assert.ok(meta.alphaBounds.x + meta.alphaBounds.width <= meta.width);
    assert.ok(meta.alphaBounds.y + meta.alphaBounds.height <= meta.height);
  }
});

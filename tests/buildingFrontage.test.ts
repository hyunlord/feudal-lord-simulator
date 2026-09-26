import assert from "node:assert/strict";
import test from "node:test";
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { buildingContactPolygon, buildingFrontage } from "../src/render/buildingFrontage";
import { getTile, type Grid, type TileCoordinate } from "../src/world/grid";
import type { Tile } from "../src/world/world.types";

const kinds = ["well", "storehouse", "granary", "logging_camp", "sawmill", "mill", "market", "chapel", "church", "keep", "quarry", "masonry"] as const;
function building(kind: BuildingKind, tx = 2, ty = 2): Building {
  return { id: "workshop", kind, tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
function fixture(owner: Building, roads: readonly TileCoordinate[]): Grid {
  const size = BUILDING_CONFIG_BY_KIND[owner.kind];
  return { width: 6, height: 6, tiles: Array.from({ length: 36 }, (_, index): Tile => {
    const tx = index % 6;
    const ty = Math.floor(index / 6);
    const inside = tx >= owner.tx && tx < owner.tx + size.width && ty >= owner.ty && ty < owner.ty + size.height;
    return { tx, ty, terrain: "grass", buildingId: inside ? owner.id : null, hasRoad: roads.some(road => road.tx === tx && road.ty === ty) };
  }) };
}
function changed(grid: Grid, coordinate: TileCoordinate, values: Partial<Tile>): Grid {
  return { ...grid, tiles: grid.tiles.map(tile => tile.tx === coordinate.tx && tile.ty === coordinate.ty ? { ...tile, ...values } : tile) };
}
function assertPolygonWithin(grid: Grid, polygon: readonly TileCoordinate[], allowed: (tile: Tile) => boolean): void {
  assert.ok(polygon.length >= 3);
  for (const [index, point] of polygon.entries()) {
    assert.ok(Number.isFinite(point.tx) && Number.isFinite(point.ty));
    const next = polygon[(index + 1) % polygon.length];
    assert.ok(next);
    for (let step = 0; step <= 20; step += 1) {
      const tx = point.tx + (next.tx - point.tx) * step / 20;
      const ty = point.ty + (next.ty - point.ty) * step / 20;
      const tile = getTile(grid, { tx: Math.round(tx), ty: Math.round(ty) });
      assert.ok(tile && allowed(tile), `polygon escapes allowed cells at ${tx},${ty}`);
    }
  }
}

test("every perimeter road contact gets bounded access for each supported footprint", () => {
  // Given all cardinal perimeter contacts, including both contacts along 2x2 sides.
  for (const kind of kinds) {
    const owner = building(kind);
    const size = BUILDING_CONFIG_BY_KIND[kind];
    const roads = [
      ...Array.from({ length: size.width }, (_, dx) => [{ tx: 2 + dx, ty: 1 }, { tx: 2 + dx, ty: 2 + size.height }]).flat(),
      ...Array.from({ length: size.height }, (_, dy) => [{ tx: 1, ty: 2 + dy }, { tx: 2 + size.width, ty: 2 + dy }]).flat(),
    ];
    const grid = fixture(owner, roads);
    const before = JSON.stringify(grid);
    // When deriving visual access.
    const result = buildingFrontage(grid, owner, 17);
    // Then every canonical contact is represented, with no terrain spill or mutation.
    assert.ok(result);
    assert.deepEqual(result.paths.map(path => path.road), buildingRoadAccessTiles(grid, owner));
    assertPolygonWithin(grid, result.pad, tile => tile.buildingId === owner.id);
    for (const path of result.paths) {
      for (const polygon of [path.polygon, path.edge, path.interior, path.interiorEdge]) {
        assertPolygonWithin(grid, polygon, tile => tile.buildingId === owner.id || (tile.tx === path.road.tx && tile.ty === path.road.ty));
      }
      assert.ok(path.polygon.some(point => Math.round(point.tx) === path.road.tx && Math.round(point.ty) === path.road.ty));
    }
    assert.equal(JSON.stringify(grid), before);
    assert.deepEqual(buildingFrontage(grid, owner, 17), result);
  }
});

test("diagonal, occupied, water and rock roads cannot create access", () => {
  // Given invalid apparent roads and a valid well footprint.
  const owner = building("well");
  const road = { tx: 2, ty: 3 };
  const base = fixture(owner, [road]);
  for (const grid of [fixture(owner, [{ tx: 3, ty: 3 }]), changed(base, road, { terrain: "water" }),
    changed(base, road, { terrain: "rock" }), changed(base, road, { buildingId: "neighbor" })]) {
    // When computing frontage, then no spur is created.
    assert.deepEqual(buildingFrontage(grid, owner, 7)?.paths, []);
  }
});

test("road removal and rebuilding immediately update frontage without stale access", () => {
  // Given a well disconnected from one road and reconnected on the opposite side.
  const owner = building("well");
  const first = { tx: 1, ty: 2 };
  const second = { tx: 3, ty: 2 };
  const initial = fixture(owner, [first]);
  const removed = changed(initial, first, { hasRoad: false });
  const rebuilt = changed(removed, second, { hasRoad: true });
  // When deriving each state, then connections match its current roads.
  assert.deepEqual(buildingFrontage(initial, owner, 2)?.paths.map(path => path.road), [first]);
  assert.deepEqual(buildingFrontage(removed, owner, 2)?.paths, []);
  assert.deepEqual(buildingFrontage(rebuilt, owner, 2)?.paths.map(path => path.road), [second]);
});

test("missing or corrupt footprint ownership never draws over a foreign tile", () => {
  // Given a multi-cell building whose footprint was removed, occupied or made impassable.
  const owner = building("storehouse");
  const grid = fixture(owner, [{ tx: 2, ty: 1 }]);
  for (const values of [{ buildingId: null }, { buildingId: "other" }, { terrain: "water" as const }, { terrain: "rock" as const }]) {
    // When deriving the old building, then its entire frontage is suppressed.
    assert.equal(buildingFrontage(changed(grid, { tx: 3, ty: 3 }, values), owner, 3), null);
  }
});

test("map corners and seed variation stay bounded while footprint contact is road-independent", () => {
  for (const kind of kinds) {
    const size = BUILDING_CONFIG_BY_KIND[kind];
    for (const [tx, ty] of [[0, 0], [6 - size.width, 6 - size.height]] as const) {
      const owner = building(kind, tx, ty);
      const grid = fixture(owner, []);
      // When drawing any seeded wear at a world edge, then every mark stays on owned land.
      for (let seed = 0; seed < 30; seed += 1) {
        const result = buildingFrontage(grid, owner, seed);
        assert.ok(result);
        assert.deepEqual(result.paths, []);
        assertPolygonWithin(grid, result.pad, tile => tile.buildingId === owner.id);
      }
      assertPolygonWithin(grid, buildingContactPolygon(owner), tile => tile.buildingId === owner.id);
    }
  }
});

test("single houses and crops retain their dedicated ground rendering", () => {
  for (const kind of ["house", "wheat_farm"] as const) {
    const owner = building(kind);
    // Given an out-of-scope kind, when computing frontage, then no new geometry is produced.
    assert.equal(buildingFrontage(fixture(owner, []), owner, 1), null);
  }
});

test("multi-tile contact meets the fitted sprite's footprint centre (R0-2)", () => {
  // Given a 2x2 storehouse whose art is fitted to its footprint (buildingSpriteFit), centred on the diamond.
  const owner = building("storehouse");
  // When generating its contact polygon.
  const contact = buildingContactPolygon(owner);
  // Then it straddles the footprint centre (the old far-tile anchor left it a half tile off the fitted art).
  const tx = contact.map(point => point.tx);
  const ty = contact.map(point => point.ty);
  assert.ok(Math.min(...tx) < owner.tx + 0.5 && Math.max(...tx) > owner.tx + 0.5);
  assert.ok(Math.min(...ty) < owner.ty + 0.5 && Math.max(...ty) > owner.ty + 0.5);
});


function contains(polygon: readonly TileCoordinate[], point: TileCoordinate): boolean {
  let inside = false;
  for (const [index, a] of polygon.entries()) {
    const b = polygon[(index + 1) % polygon.length];
    assert.ok(b);
    if ((a.ty > point.ty) !== (b.ty > point.ty)
      && point.tx < (b.tx - a.tx) * (point.ty - a.ty) / (b.ty - a.ty) + a.tx) inside = !inside;
  }
  return inside;
}

test("every approach joins the actual fixed sprite contact with an overlapping interior strip", () => {
  for (const kind of kinds) {
    const owner = building(kind);
    const size = BUILDING_CONFIG_BY_KIND[kind];
    const allRoads = fixture(owner, []).tiles.filter(tile => tile.buildingId === null);
    const grid = fixture(owner, allRoads);
    // Given roads on every perimeter, when deriving each approach.
    const frontage = buildingFrontage(grid, owner, 11);
    assert.ok(frontage);
    for (const path of frontage.paths) {
      const anchor = { tx: owner.tx + (size.width - 1) / 2, ty: owner.ty + (size.height - 1) / 2 }; // R0-2: every art on its centre
      const origin = { tx: Math.max(owner.tx, Math.min(path.road.tx, owner.tx + size.width - 1)),
        ty: Math.max(owner.ty, Math.min(path.road.ty, owner.ty + size.height - 1)) };
      const overlap = { tx: origin.tx + (path.road.tx - origin.tx) * 0.15,
        ty: origin.ty + (path.road.ty - origin.ty) * 0.15 };
      // Then the building contact and road-facing strip share continuous painted ground.
      assert.ok(contains(path.interior, anchor), `${kind}: sprite contact missing`);
      assert.ok(contains(path.interior, overlap), `${kind}: interior gap`);
      assert.ok(contains(path.polygon, overlap), `${kind}: road approach gap`);
      assertPolygonWithin(grid, path.interior, tile => tile.buildingId === owner.id);
      assertPolygonWithin(grid, path.interiorEdge, tile => tile.buildingId === owner.id);
    }
  }
});

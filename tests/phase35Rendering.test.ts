import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import { PALETTE } from "../src/content/palette";
import {
  buildingBodyProfile,
  buildingLodColor,
  renderDetailLevel,
} from "../src/render/buildingVisualState";
import { clearedTreeTileKeys } from "../src/render/objectRenderOrder";
import {
  groundDecalFor,
  roadConnectionArms,
} from "../src/render/terrainDetails";
import { walkerScaleForZoom } from "../src/render/drawWalkers";
import type { Tile } from "../src/world/world.types";

function building(id: string, kind: BuildingKind, tx: number, ty: number): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

test("every building kind and house level has a unique body and roof signature", () => {
  const profiles = [
    ...[0, 1, 2, 3].map((level) => [
      `house-${level}`,
      buildingBodyProfile("house", level),
    ] as const),
    ...(["well", "storehouse", "granary", "wheat_farm", "mill", "logging_camp", "sawmill"] as const)
      .map((kind) => [kind, buildingBodyProfile(kind, 0)] as const),
  ];
  const signatures = profiles.map(([, profile]) =>
    `${profile.width}:${profile.height}:${profile.roof}:${profile.roofShape}`,
  );

  assert.equal(new Set(signatures).size, profiles.length);
  assert.equal(buildingBodyProfile("well", 0).roofShape, "none");
  assert.equal(buildingBodyProfile("granary", 0).roofShape, "dome");
  assert.equal(buildingBodyProfile("mill", 0).roofShape, "cone");
});

test("zoom detail policy preserves city mass at overview scale", () => {
  assert.equal(renderDetailLevel(0.49), "blocks");
  assert.equal(renderDetailLevel(0.5), "blocks");
  assert.equal(renderDetailLevel(0.69), "simplified");
  assert.equal(renderDetailLevel(0.7), "full");
  assert.equal(buildingLodColor("house"), PALETTE.parchmentDark);
  assert.equal(buildingLodColor("storehouse"), PALETTE.stone);
  assert.equal(buildingLodColor("mill"), PALETTE.earth);
});

test("building footprints clear their eight-neighbour apron from trees", () => {
  const keys = clearedTreeTileKeys([
    building("house", "house", 4, 5),
    building("store", "storehouse", 8, 8),
  ]);

  for (let ty = 4; ty <= 6; ty += 1) {
    for (let tx = 3; tx <= 5; tx += 1) assert.ok(keys.has(`${tx}:${ty}`));
  }
  assert.ok(keys.has("7:7"));
  assert.ok(keys.has("10:10"));
  assert.equal(keys.has("11:11"), false);
});

test("ground decals are deterministic and sparse", () => {
  const first = Array.from({ length: 400 }, (_, index) =>
    groundDecalFor(index % 20, Math.floor(index / 20), 73),
  );
  const second = Array.from({ length: 400 }, (_, index) =>
    groundDecalFor(index % 20, Math.floor(index / 20), 73),
  );
  const tufts = first.filter((decal) => decal.kind === "tufts").length;
  const rocks = first.filter((decal) => decal.kind === "rock").length;

  assert.deepEqual(first, second);
  assert.ok(tufts >= 40 && tufts <= 80, `tufts=${tufts}`);
  assert.ok(rocks >= 10 && rocks <= 30, `rocks=${rocks}`);
  assert.ok(first.every((decal) => decal.kind !== "tufts" || (decal.count >= 2 && decal.count <= 4)));
});

test("road arms distinguish a straight run from a junction and reject diagonals", () => {
  const tile = (tx: number, ty: number, hasRoad: boolean): Tile => ({
    tx,
    ty,
    terrain: "grass",
    buildingId: null,
    hasRoad,
  });
  const straight = roadConnectionArms(tile(2, 2, true), [
    tile(2, 1, true), tile(3, 2, false), tile(2, 3, true), tile(1, 2, false),
  ]);
  const junction = roadConnectionArms(tile(2, 2, true), [
    tile(2, 1, true), tile(3, 2, true), tile(2, 3, true), tile(1, 2, false),
    tile(3, 3, true),
  ]);

  assert.deepEqual(straight, ["north", "south"]);
  assert.deepEqual(junction, ["north", "east", "south"]);
});

test("walker marks keep at least their 0.8x on-screen size", () => {
  assert.equal(walkerScaleForZoom(1), 1);
  assert.equal(walkerScaleForZoom(0.8), 1);
  assert.equal(walkerScaleForZoom(0.5), 1.6);
});

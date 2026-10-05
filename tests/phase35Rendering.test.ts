import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import { SEMANTIC_PALETTE } from "../src/content/palette";
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
import { actorFrameDestination } from "../src/render/runtimeActorAssets";
import { runtimeActorManifest } from "../src/render/runtimeActorManifest.generated";
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
  // NAT-2 QA-008: blocks only on the strategic map (<= 0.35); 0.5 (the game's widest) keeps the painted art.
  assert.equal(renderDetailLevel(0.3), "blocks");
  assert.equal(renderDetailLevel(0.35), "blocks");
  // NAT-2 (user): no second "simplified" set of rules — the painted art and every feature by the same rules above it.
  assert.equal(renderDetailLevel(0.36), "full");
  assert.equal(renderDetailLevel(0.5), "full");
  assert.equal(renderDetailLevel(0.7), "full");
  assert.equal(renderDetailLevel(0.7001), "full");
  assert.equal(buildingLodColor("house"), SEMANTIC_PALETTE.parchmentDark);
  assert.equal(buildingLodColor("storehouse"), SEMANTIC_PALETTE.stone);
  assert.equal(buildingLodColor("mill"), SEMANTIC_PALETTE.earth);
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

test("villagers use the FND-3 registered height while retaining the existing zoom floor", () => {
  // Given the camera's actual .5–2 range and the unchanged .65 floor.
  for (const zoom of [0.65, 0.8, 1, 1.4, 2]) assert.equal(walkerScaleForZoom(zoom), 0.55);
  // When the existing draw scale is projected to screen pixels.
  for (const zoom of [0.5, 0.55, 0.6, 0.65]) {
    const screenHeight = 32 * walkerScaleForZoom(zoom) * zoom;
    // Then the FND-3 figure keeps the old floor policy, with its new registered height.
    assert.ok(Math.abs(screenHeight - 11.44) < 0.000_001, `zoom ${zoom}: ${screenHeight} px`);
  }
  for (const zoom of [0.650001, 0.7, 0.8, 1, 1.4, 2]) {
    assert.ok(Math.abs(32 * walkerScaleForZoom(zoom) * zoom - 17.6 * zoom) < 0.000_001);
  }
  assert.ok(Math.abs(32 * walkerScaleForZoom(0.649999) * 0.649999 - 11.44) < 0.000_001);
});

test("registered actor destinations enlarge once while preserving each source foot anchor", () => {
  // Given the real actor crops and feet in all roles, directions and gait frames.
  for (const actor of runtimeActorManifest) for (const frame of actor.frames) {
    const before = actorFrameDestination(frame, 123, 456, 0.5);
    // When the renderer's actual zoom-one scale reaches the destination adapter.
    const after = actorFrameDestination(frame, 123, 456, walkerScaleForZoom(1));
    // Then width and registered height grow by 10%, around the same registered foot.
    assert.ok(Math.abs(after.height - 17.6) < 1e-9);
    assert.ok(Math.abs(after.width / before.width - 1.1) < 1e-9);
    assert.ok(Math.abs(after.x + (frame.foot.x - frame.source.x) * after.width / frame.source.width - 123) < 1e-8);
    assert.ok(Math.abs(after.y + (frame.foot.y - frame.source.y) * after.height / frame.source.height - 456) < 1e-8);
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { recordingCanvas } from "../scripts/recordingCanvas";
import { seedGroundState } from "../scripts/boundaryFixtureStates";
import { drawWallFaceSlice, drawWallModules } from "../src/render/drawWallFaces";
import { setShoreAssetsForTest } from "../src/render/terrainVariantAssets";
import { TERRAIN_VARIANT_ASSETS, WALL_FACE_KEYS } from "../src/render/terrainVariantManifest";
import { wallBaselinesFor } from "../src/render/wallBaselineCache";

// D3b-2 wall strips v2: every completed wall draws a face and a top strip (or, seen end-on, the diag top), and a
// stone 90 degree corner is the Wave 4d tower. Images are labelled stand-ins (Node has no decoder).
setShoreAssetsForTest(Object.fromEntries(WALL_FACE_KEYS.map(key => {
  const asset = TERRAIN_VARIANT_ASSETS.find(candidate => candidate.key === key)!;
  return [key, { label: key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height } as unknown as HTMLImageElement];
})));

test("Given the seed 3 stone town When every wall slice is drawn Then faces, tops and end-on top views are all laid, and no D3b v1 face or flat cap", () => {
  const state = seedGroundState(3);
  const { slices } = wallBaselinesFor(state);
  const { context, canvas } = recordingCanvas(4096, 4096);
  for (const slice of slices.values()) drawWallFaceSlice(context, slice);
  const ops = canvas.ops.join("\n");
  for (const key of ["stone_face_v2_a", "stone_top_a", "stone_diag_top"]) assert.match(ops, new RegExp(`fillStyle\\(pattern[0-9]+:${key}\\)`), `${key} drawn`);
  assert.doesNotMatch(ops, /stone_face_a[^_]/, "the D3b v1 face is not drawn");
  const fills = canvas.ops.filter(op => op.startsWith("fill(") || op === "fill()").length;
  assert.ok(fills > slices.size * 2, `each slice lays several layers (${fills} fills for ${slices.size} slices)`);
});

test("Given a stone tower node When the modules are drawn Then the Wave 4d corner tower stands there; a timber tower keeps its post", () => {
  const state = seedGroundState(3);
  const { walls } = wallBaselinesFor(state);
  const tower = walls.nodes.find(node => node.kind === "tower");
  assert.ok(tower !== undefined, "seed 3 has a tower");
  const stone = recordingCanvas(4096, 4096);
  drawWallModules(stone.context, [{ ...tower, materials: ["stone"] }], [], "stone", 1);
  assert.match(stone.canvas.ops.join("\n"), /drawImage\(stone_tower_corner/);
  const timber = recordingCanvas(4096, 4096);
  drawWallModules(timber.context, [{ ...tower, materials: ["timber"] }], [], "timber", 1);
  assert.doesNotMatch(timber.canvas.ops.join("\n"), /stone_tower_corner/);
});

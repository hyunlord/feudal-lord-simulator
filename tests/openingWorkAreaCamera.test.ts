import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import { MAX_ZOOM, worldToCanvas, type CameraState } from "../src/render/camera";
import { cameraForStartingHouse, initialCamera } from "../src/render/canvasRuntime";
import { tileToScreen } from "../src/render/iso";
import { runtimeWorldAssetManifest } from "../src/render/worldAssetManifest.generated";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { OPENING_VILLAGE_CENTER } from "../src/state/openingVillage";

// A new game opens on the work area (four cottages, the well and the road ring around them), not the whole village.

const DESKTOP_CONSOLE_HEIGHT = 150;
const ROAD_RING = { minTx: 43, maxTx: 47, minTy: 39, maxTy: 43 } as const;

function spriteRect(building: Building, camera: CameraState) {
  const key = building.kind === "house" ? "house_l0" : building.kind;
  const meta = runtimeWorldAssetManifest.assets.find((asset) => asset.key === key);
  if (meta === undefined) throw new Error(`Missing sprite metadata for ${key}`);
  const anchor = worldToCanvas({ x: tileToScreen(building.tx, building.ty).sx, y: tileToScreen(building.tx, building.ty).sy }, camera);
  return {
    minX: anchor.x - meta.anchor.x * meta.renderScale * camera.zoom,
    minY: anchor.y - meta.anchor.y * meta.renderScale * camera.zoom,
    maxX: anchor.x + (meta.width - meta.anchor.x) * meta.renderScale * camera.zoom,
    maxY: anchor.y + (meta.height - meta.anchor.y) * meta.renderScale * camera.zoom,
  };
}

function tileOnCanvas(tx: number, ty: number, camera: CameraState) {
  const screen = tileToScreen(tx, ty);
  return worldToCanvas({ x: screen.sx, y: screen.sy }, camera);
}

test("a fresh game at 1280x800 frames the cottages, the well and the road around them", () => {
  // Given
  const canvas = { clientWidth: 1280, clientHeight: 800 };
  const usableHeight = canvas.clientHeight - DESKTOP_CONSOLE_HEIGHT;

  // When
  const camera = initialCamera(canvas, DEFAULT_GAME_STATE);

  // Then: zoomed in to the work area (at most ~10 iso tiles across the viewport) and centred on the village centre.
  assert.ok(camera.zoom >= 1.6 && camera.zoom <= MAX_ZOOM, `zoom ${camera.zoom}`);
  assert.ok(canvas.clientWidth / (64 * camera.zoom) <= 10.5, `tiles across ${canvas.clientWidth / (64 * camera.zoom)}`);
  const centre = tileOnCanvas(OPENING_VILLAGE_CENTER.tx, OPENING_VILLAGE_CENTER.ty, camera);
  assert.ok(Math.abs(centre.x - canvas.clientWidth / 2) <= 1 && Math.abs(centre.y - usableHeight / 2) <= 1);
  // Every cottage and the well are fully on screen above the court console.
  for (const building of DEFAULT_GAME_STATE.buildings.filter((candidate) => candidate.kind === "house" || candidate.kind === "well")) {
    const rect = spriteRect(building, camera);
    assert.ok(rect.minX >= 0 && rect.maxX <= canvas.clientWidth && rect.minY >= 0 && rect.maxY <= usableHeight,
      `${building.id} ${JSON.stringify(rect)}`);
  }
  // The road ring around them is on screen.
  for (let tx = ROAD_RING.minTx; tx <= ROAD_RING.maxTx; tx += 1) {
    for (let ty = ROAD_RING.minTy; ty <= ROAD_RING.maxTy; ty += 1) {
      const point = tileOnCanvas(tx, ty, camera);
      assert.ok(point.x >= 0 && point.x <= canvas.clientWidth && point.y >= 0 && point.y <= usableHeight, `${tx},${ty}`);
    }
  }
});

test("the work-area zoom adapts to the viewport and stays inside the camera limits", () => {
  const zoomAt = (width: number, height: number) => cameraForStartingHouse({ clientWidth: width, clientHeight: height }, DEFAULT_GAME_STATE).zoom;
  assert.equal(zoomAt(1600, 1100), MAX_ZOOM);
  assert.ok(zoomAt(1280, 720) < zoomAt(1280, 800), "a shorter viewport zooms out a little");
  assert.ok(zoomAt(1280, 720) >= 1.6);
  // Compact viewports keep their readable 80px sprite floor (openingCameraLegibility.test.ts), not a smaller fit.
  assert.ok(zoomAt(375, 812) >= 1.6);
});

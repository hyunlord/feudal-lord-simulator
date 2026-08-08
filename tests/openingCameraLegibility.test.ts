import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import { worldToCanvas, type CameraState } from "../src/render/camera";
import { cameraAfterViewportResize, cameraForStartingHouse } from "../src/render/canvasRuntime";
import { tileToScreen } from "../src/render/iso";
import { runtimeWorldAssetManifest } from "../src/render/worldAssetManifest.generated";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type LegibilityScenario = {
  readonly width: number;
  readonly height: number;
  readonly consoleHeight: number;
  readonly topInset: number;
};

const MIN_ONE_BY_ONE_BUILDING_PX = 80;

test("cameraAfterViewportResize keeps compact opening 1x1 buildings above the pixel floor", () => {
  // Given: browser QA starts from desktop, then resizes into the rejected compact openings.
  const desktopCamera = cameraForStartingHouse({ clientWidth: 1280, clientHeight: 720 }, DEFAULT_GAME_STATE);
  const scenarios: readonly LegibilityScenario[] = [
    { width: 375, height: 640, consoleHeight: 224, topInset: 176 },
    { width: 375, height: 720, consoleHeight: 224, topInset: 176 },
    { width: 768, height: 720, consoleHeight: 276, topInset: 0 },
  ];

  for (const scenario of scenarios) {
    // When: the untouched opening camera is recomputed for the compact viewport.
    const camera = cameraAfterViewportResize({
      camera: desktopCamera,
      canvas: { clientWidth: scenario.width, clientHeight: scenario.height },
      state: DEFAULT_GAME_STATE,
      userControlled: false,
    });

    // Then: actual 1x1 building sprites render large enough to read as buildings.
    const safeMap = {
      x: 0,
      y: scenario.topInset,
      width: scenario.width,
      height: scenario.height - scenario.consoleHeight - scenario.topInset,
    };
    for (const building of DEFAULT_GAME_STATE.buildings) {
      const spriteRect = projectedOpeningSpriteRect(building, camera);
      const renderedMinPx = Math.min(spriteRect.width, spriteRect.height);
      assert.ok(
        renderedMinPx >= MIN_ONE_BY_ONE_BUILDING_PX,
        `${scenario.width}x${scenario.height} ${building.id} rendered ${renderedMinPx}px`,
      );
      const visibleRect = intersectRects(spriteRect, safeMap);
      assert.ok(visibleRect.width > 0, `${scenario.width}x${scenario.height} ${building.id} visible width ${visibleRect.width}`);
      assert.ok(visibleRect.height > 0, `${scenario.width}x${scenario.height} ${building.id} visible height ${visibleRect.height}`);
    }
  }
});

test("automatic opening fit uses the same 80px minimum as startup", () => {
  // Given: a malformed narrow viewport should still be clamped to a deterministic readable opening.
  const camera = cameraForStartingHouse({ clientWidth: 1, clientHeight: 640 }, DEFAULT_GAME_STATE);

  // When
  const renderedMins = DEFAULT_GAME_STATE.buildings.map((building) =>
    Math.min(projectedOpeningSpriteRect(building, camera).width, projectedOpeningSpriteRect(building, camera).height),
  );

  // Then
  assert.equal(Math.min(...renderedMins), MIN_ONE_BY_ONE_BUILDING_PX);
});

function projectedOpeningSpriteRect(building: Building, camera: CameraState): Rect {
  const meta = spriteMeta(building.kind === "house" ? "house_l0" : "well");
  const anchor = tileToScreen(building.tx, building.ty);
  const canvasAnchor = worldToCanvas({ x: anchor.sx, y: anchor.sy }, camera);
  return {
    x: canvasAnchor.x - meta.anchor.x * camera.zoom,
    y: canvasAnchor.y - meta.anchor.y * camera.zoom,
    width: meta.width * camera.zoom,
    height: meta.height * camera.zoom,
  };
}

function spriteMeta(key: "house_l0" | "well") {
  const meta = runtimeWorldAssetManifest.assets.find((asset) => asset.key === key);
  if (meta === undefined) throw new Error(`Missing sprite metadata for ${key}`);
  return meta;
}

function intersectRects(left: Rect, right: Rect): Rect {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  return {
    x,
    y,
    width: Math.max(0, rightEdge - x),
    height: Math.max(0, bottomEdge - y),
  };
}

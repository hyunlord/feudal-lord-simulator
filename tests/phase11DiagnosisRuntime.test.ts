import assert from "node:assert/strict";
import test from "node:test";

import { renderDetailLevel } from "../src/render/buildingVisualState";
import {
  installWorldSpriteDrawProbe,
} from "../src/render/worldSpriteDiagnostics";
import { drawWorldSpriteAtWorldAnchor } from "../src/render/worldSprite";
import { runtimeWorldAssetManifest } from "../src/render/worldAssetManifest.generated";
import { worldAssetStatuses } from "../src/render/worldAssets";
import { installPhase10ProofRuntime } from "../src/testing/phase10ProofRuntime";

test("Given the runtime manifest When diagnosis reads loader state Then every sprite key has a status", () => {
  // Given
  const expectedKeys = runtimeWorldAssetManifest.assets.map((asset) => asset.key);

  // When
  const statuses = worldAssetStatuses();

  // Then
  assert.deepEqual(statuses.map((asset) => asset.key), expectedKeys);
  assert.equal(statuses.every((asset) => asset.status === "idle"), true);
});

test("Given an unavailable runtime sprite When it is drawn under diagnosis Then the false return is recorded", () => {
  // Given
  const probe = installWorldSpriteDrawProbe();
  const context = {
    canvas: { width: 64, height: 64 },
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    save() {},
    restore() {},
    setTransform() {},
    drawImage() {},
  };

  // When
  const drawn = drawWorldSpriteAtWorldAnchor(context, "missing_phase11_sprite", 0, 0);

  // Then
  assert.equal(drawn, false);
  assert.deepEqual(probe.snapshot().recent, [
    { key: "missing_phase11_sprite", drawn: false, reason: "meta_missing" },
  ]);
  probe.dispose();
});

test("Given the published proof gate When diagnosis is read Then camera LOD and loader state are exposed read-only", () => {
  // Given
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  try {
    const dispose = installPhase10ProofRuntime({
      canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } as HTMLCanvasElement,
      cameraRef: { current: { zoom: 1.1, panX: 0, panY: 0 } },
      stateRef: { current: {} } as never,
      location: { hostname: "hyunlord.github.io", search: "?phase10-proof=1" },
    });

    // When
    const diagnosis = window.__FEUDAL_PHASE10_PROOF__?.diagnosis();

    // Then
    assert.equal(diagnosis?.camera.zoom, 1.1);
    assert.equal(diagnosis?.camera.lod, renderDetailLevel(1.1));
    assert.deepEqual(diagnosis?.assets.map((asset) => asset.key), runtimeWorldAssetManifest.assets.map((asset) => asset.key));
    dispose();
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});

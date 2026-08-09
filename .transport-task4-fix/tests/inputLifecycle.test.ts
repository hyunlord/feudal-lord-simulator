import assert from "node:assert/strict";
import test from "node:test";

import { releaseTileFromMouseEvent } from "../src/render/inputLifecycle";
import type { CameraState } from "../src/render/camera";

const CAMERA: CameraState = { zoom: 1, panX: 0, panY: 0 };
const RECT = { left: 100, top: 50, width: 320, height: 200 };

test("releaseTileFromMouseEvent recomputes the tile from the mouseup point", () => {
  // Given
  const event = { clientX: 132, clientY: 82 };

  // When
  const tile = releaseTileFromMouseEvent(event, RECT, CAMERA);

  // Then
  assert.deepEqual(tile, { tx: 1, ty: 0 });
});

test("releaseTileFromMouseEvent returns null when mouseup is outside the canvas", () => {
  // Given
  const event = { clientX: 90, clientY: 82 };

  // When
  const tile = releaseTileFromMouseEvent(event, RECT, CAMERA);

  // Then
  assert.equal(tile, null);
});

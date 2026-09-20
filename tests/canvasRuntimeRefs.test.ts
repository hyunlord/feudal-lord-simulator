import assert from "node:assert/strict";
import test from "node:test";
import { createCanvasMutableRefs } from "../src/render/canvasRuntimeRefs";

test("each canvas mount starts with independent neutral interaction refs", () => {
  const camera = { panX: 20, panY: 30, zoom: 1 };
  const first = createCanvasMutableRefs(camera);
  const second = createCanvasMutableRefs(camera);
  first.spacePressed.current = true;
  assert.equal(second.spacePressed.current, false);
  assert.equal(first.cameraRef.current, camera);
  assert.equal(first.hoverRef.current, null);
  assert.equal(first.feedbackRef.current, null);
  assert.equal(first.suppressClick.current, false);
  assert.equal(first.pixelRatioRef.current, 1);
  assert.deepEqual(first.dragRef.current, { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false });
  assert.notEqual(first.completionTracker, second.completionTracker);
});

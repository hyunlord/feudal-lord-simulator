import assert from "node:assert/strict";
import test from "node:test";
import { runtimeActorManifest } from "../src/render/runtimeActorManifest.generated";
import { actorFrameDestination, actorFrameFor, createRuntimeActorLoader } from "../src/render/runtimeActorAssets";
import { WALKER_PRESENTATION_DIRECTIONS, WALKER_PRESENTATION_GAIT_FRAMES, WALKER_PRESENTATION_ROLES } from "../src/render/walkerPresentation";

test("registered actor feet stay on the walker anchor in all four directions and both poses", () => {
  // Given
  for (const role of WALKER_PRESENTATION_ROLES) for (const direction of WALKER_PRESENTATION_DIRECTIONS) for (const gaitFrame of WALKER_PRESENTATION_GAIT_FRAMES) {
    const frame = actorFrameFor({ role, direction, gaitFrame });
    assert.ok(frame);
    // When
    const rect = actorFrameDestination(frame, 123, 456, 0.55);
    // Then
    assert.ok(Math.abs(rect.x + (frame.foot.x - frame.source.x) * rect.width / frame.source.width - 123) < 1e-8);
    assert.ok(Math.abs(rect.y + (frame.foot.y - frame.source.y) * rect.height / frame.source.height - 456) < 1e-8);
    assert.equal(rect.height, 32 * 0.55);
  }
});

test("registered frames stay inside original sheets without mirroring or shared pose crops", () => {
  // Given
  for (const meta of runtimeActorManifest) {
    // When
    const keys = new Set(meta.frames.map(frame => `${frame.source.x},${frame.source.y}`));
    // Then
    assert.equal(keys.size, meta.frames.length);
    for (const { source } of meta.frames) {
      assert.ok(source.x >= 0 && source.y >= 0);
      assert.ok(source.x + source.width <= meta.width && source.y + source.height <= meta.height);
      assert.ok(source.width > 0 && source.height > 0);
    }
  }
});

test("image failures settle all active actor loads and keep missing sprites unavailable", async () => {
  // Given: no image environment is a supported procedural fallback, not a thrown error.
  const loader = createRuntimeActorLoader(() => null);
  // When
  await loader.preload();
  // Then
  assert.ok(loader.statuses().filter(asset => asset.active).every(asset => asset.status === "missing"));
  assert.equal(loader.image("builder"), null);
  assert.ok(loader.statuses().filter(asset => !asset.active).every(asset => asset.status === "idle"));
});

test("actor image constructor exceptions settle preload without a rejected promise", async () => {
  // Given
  const loader = createRuntimeActorLoader(() => { throw new Error("Image constructor unavailable"); });
  // When
  await loader.preload();
  // Then
  assert.ok(loader.statuses().filter(asset => asset.active).every(asset =>
    asset.status === "missing" && asset.rasterError === "Image constructor unavailable"));
});

test("actor URLs resolve under the application base instead of becoming protocol-relative hosts", () => {
  // Given
  const loader = createRuntimeActorLoader(() => null);
  // When
  const urls = loader.statuses().map(asset => asset.url);
  // Then
  assert.ok(urls.every(url => url.startsWith("/assets/runtime-actors-v1/") && !url.startsWith("//")));
});

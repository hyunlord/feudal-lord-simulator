import assert from "node:assert/strict";
import test from "node:test";

import { drawOnboardingGuidanceOverlay } from "../src/render/onboardingGuidanceOverlay";
import {
  createOnboardingGuidancePlaqueContext,
  plaqueBoxFrom,
} from "./helpers/onboardingGuidanceOverlayContext";

test("drawOnboardingGuidanceOverlay derives a bottom safe bound from the court console at high DPR", () => {
  // Given
  const { calls, context } = createOnboardingGuidancePlaqueContext({
    canvasClientWidth: 640,
    canvasClientHeight: 375,
    canvasPixelWidth: 1_280,
    canvasPixelHeight: 750,
    transform: { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 },
    consoleBounds: { left: 0, top: 151, right: 640, bottom: 375 },
    overlayRoot: "app-shell",
  });

  // When
  drawOnboardingGuidanceOverlay(context, {
    targets: [{ kind: "logging_camp", label: "여기에 벌목소를 지으세요", origin: { tx: 13, ty: 0 } }],
    zoom: 1,
  });

  // Then
  const plaque = plaqueBoxFrom(calls);
  assert.ok(plaque);
  assert.equal(plaque.rectY + plaque.rectHeight, 151);
  assert.equal(plaque.textY <= 151, true);
});

test("drawOnboardingGuidanceOverlay suppresses a low-height console plaque without hiding the marker", () => {
  // Given
  const { calls, context } = createOnboardingGuidancePlaqueContext({
    canvasClientWidth: 640,
    canvasClientHeight: 375,
    canvasPixelWidth: 1_280,
    canvasPixelHeight: 750,
    transform: { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 },
    consoleBounds: { left: 0, top: 18, right: 640, bottom: 375 },
  });

  // When
  drawOnboardingGuidanceOverlay(context, {
    targets: [{ kind: "logging_camp", label: "여기에 벌목소를 지으세요", origin: { tx: 13, ty: 0 } }],
    zoom: 1,
  });

  // Then
  assert.equal(calls.includes("beginPath"), true);
  assert.equal(calls.includes("fill"), true);
  assert.equal(calls.some((call) => call.startsWith("fillRect:")), false);
  assert.equal(calls.some((call) => call.startsWith("fillText:")), false);
});

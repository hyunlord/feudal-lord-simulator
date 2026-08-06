import assert from "node:assert/strict";
import test from "node:test";

import type { BuildingKind } from "../src/content/buildingConfig";
import {
  createPlacementFeedback,
  formatPlacementFailure,
  getPlacementToolStatus,
  isPlacementFeedbackVisible,
  type PlacementFeedback,
  type PlacementFeedbackAnchor,
  type PlacementFailureReason,
} from "../src/render/placementFeedback";
import { PlacementFailure } from "../src/world/placement";

test("formatPlacementFailure returns the six Korean placement messages when failures occur", () => {
  // Given
  const failures = [
    {
      reason: PlacementFailure.occupied,
      buildingKind: "house",
      expected: "이미 건물이 있습니다",
    },
    {
      reason: PlacementFailure.wrong_terrain,
      buildingKind: "house",
      expected: "물 위에는 지을 수 없습니다",
    },
    {
      reason: PlacementFailure.out_of_bounds,
      buildingKind: "house",
      expected: "영지 밖입니다",
    },
    {
      reason: PlacementFailure.needs_road,
      buildingKind: "storehouse",
      expected: "길에 닿아야 합니다 — 먼저 길을 놓으세요",
    },
    {
      reason: PlacementFailure.needs_adjacent_terrain,
      buildingKind: "logging_camp",
      expected: "숲 옆에 지어야 합니다",
    },
    {
      reason: PlacementFailure.insufficient_timber,
      buildingKind: "sawmill",
      expected: "목재가 부족합니다 (필요 30)",
    },
  ] satisfies readonly {
    readonly reason: PlacementFailureReason;
    readonly buildingKind: BuildingKind;
    readonly expected: string;
  }[];

  // When / Then
  for (const failure of failures) {
    assert.equal(formatPlacementFailure(failure.reason, failure.buildingKind), failure.expected);
  }
});

test("getPlacementToolStatus returns exact building road and fallback statuses", () => {
  // Given / When / Then
  assert.equal(
    getPlacementToolStatus({ kind: "building", buildingKind: "house" }),
    "지을 곳을 클릭하세요 — 오두막 · 취소하려면 Esc",
  );
  assert.equal(
    getPlacementToolStatus({ kind: "road" }),
    "드래그하여 길을 놓으세요 · 취소하려면 Esc",
  );
  assert.equal(getPlacementToolStatus(null), "도구를 선택하세요");
});

test("createPlacementFeedback anchors success and failure feedback with presentation-clock lifetimes", () => {
  // Given
  const tileAnchor = {
    kind: "tile",
    tile: { tx: 3, ty: 4 },
  } satisfies PlacementFeedbackAnchor;
  const pathAnchor = {
    kind: "path",
    path: [
      { tx: 1, ty: 1 },
      { tx: 1, ty: 2 },
    ],
  } satisfies PlacementFeedbackAnchor;

  // When
  const success = createPlacementFeedback({
    kind: "success",
    message: "건설했습니다",
    anchor: tileAnchor,
    nowMs: 1000,
  });
  const failure = createPlacementFeedback({
    kind: "failure",
    message: "영지 밖입니다",
    anchor: pathAnchor,
    nowMs: 2000,
  });

  // Then
  assert.deepEqual(success, {
    kind: "success",
    message: "건설했습니다",
    anchor: tileAnchor,
    createdAtMs: 1000,
    expiresAtMs: 1600,
  } satisfies PlacementFeedback);
  assert.deepEqual(failure, {
    kind: "failure",
    message: "영지 밖입니다",
    anchor: pathAnchor,
    createdAtMs: 2000,
    expiresAtMs: 6500,
  } satisfies PlacementFeedback);
});

test("isPlacementFeedbackVisible expires success at 600ms and failure at 4500ms without tick input", () => {
  // Given
  const anchor = {
    kind: "tile",
    tile: { tx: 0, ty: 0 },
  } satisfies PlacementFeedbackAnchor;
  const success = createPlacementFeedback({
    kind: "success",
    message: "ok",
    anchor,
    nowMs: 0,
  });
  const failure = createPlacementFeedback({
    kind: "failure",
    message: "no",
    anchor,
    nowMs: 0,
  });

  // When / Then
  assert.equal(isPlacementFeedbackVisible(success, 599), true);
  assert.equal(isPlacementFeedbackVisible(success, 600), false);
  assert.equal(isPlacementFeedbackVisible(failure, 4499), true);
  assert.equal(isPlacementFeedbackVisible(failure, 4500), false);
});

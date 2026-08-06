import assert from "node:assert/strict";
import test from "node:test";

import type { CarterWalker } from "../src/agents/walker.types";
import {
  drawSelectedWalkerPath,
  selectedWalkerPath,
  type DiagnosticPathContext,
} from "../src/render/diagnosticPathOverlay";

function walker(): CarterWalker {
  return {
    id: "carter",
    kind: "carter",
    homeBuildingId: "source",
    destination: { kind: "building", buildingId: "destination" },
    mission: "deliver",
    phase: "outbound",
    position: { tx: 1.5, ty: 0 },
    path: [
      { tx: 0, ty: 0 },
      { tx: 1, ty: 0 },
      { tx: 2, ty: 0 },
      { tx: 2, ty: 1 },
    ],
    pathIndex: 1,
    previousTile: { tx: 1, ty: 0 },
    cargo: null,
    spawnedTick: 0,
    reservation: {
      destination: { kind: "building", buildingId: "destination" },
      resource: "timber",
      amount: 1,
      sourceStockClaim: null,
      homeCapacityClaim: null,
    },
    cancellation: null,
  };
}

function contextRecorder(): {
  readonly context: DiagnosticPathContext;
  readonly calls: readonly string[];
} {
  const calls: string[] = [];
  return {
    calls,
    context: {
      lineCap: "butt",
      lineJoin: "miter",
      lineWidth: 0,
      strokeStyle: "",
      beginPath: () => calls.push("beginPath"),
      moveTo: (x, y) => calls.push(`moveTo:${x},${y}`),
      lineTo: (x, y) => calls.push(`lineTo:${x},${y}`),
      stroke: () => calls.push("stroke"),
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
    },
  };
}

test("selected Walker path is the exact current path object", () => {
  // Given
  const selected = walker();

  // When
  const path = selectedWalkerPath(selected);

  // Then
  assert.equal(path, selected.path);
  assert.deepEqual(path, selected.path);
});

test("selected Walker path drawing traces every actual path point in order", () => {
  // Given
  const selected = walker();
  const recorder = contextRecorder();

  // When
  drawSelectedWalkerPath(recorder.context, selected, 2);

  // Then
  assert.deepEqual(recorder.calls, [
    "save",
    "beginPath",
    "moveTo:0,0",
    "lineTo:32,16",
    "lineTo:64,32",
    "lineTo:32,48",
    "stroke",
    "restore",
  ]);
  assert.equal(recorder.context.lineWidth, 1);
});

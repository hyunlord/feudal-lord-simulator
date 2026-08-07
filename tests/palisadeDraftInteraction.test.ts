import assert from "node:assert/strict";
import test from "node:test";

import {
  dragDraftRunByTiles,
  initialPalisadeDraft,
  selectPalisadeRunAtPoint,
} from "../src/render/palisadeDraftInteraction";
import type { ValidPalisadeCandidate } from "../src/world/palisadeGeometry";
import { dragPalisadeRun, validatePalisadeCandidate } from "../src/world/palisadeGeometry";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number): Tile {
  return { tx, ty, terrain: "grass", buildingId: null, hasRoad: false };
}

const grid = {
  width: 24,
  height: 24,
  tiles: Array.from({ length: 24 * 24 }, (_, index) => tile(index % 24, Math.floor(index / 24))),
};
const footprints = [
  { id: "house-a", tx: 8, ty: 8, width: 1, height: 1 },
  { id: "granary-a", tx: 10, ty: 10, width: 2, height: 2 },
];
const candidate = validatePalisadeCandidate(
  grid,
  [{ x: 4, y: 4 }, { x: 16, y: 4 }, { x: 16, y: 16 }, { x: 4, y: 16 }, { x: 4, y: 4 }],
  footprints,
);
if (!candidate.ok) throw new Error("fixture candidate must be valid");
const validCandidate: ValidPalisadeCandidate = candidate.candidate;

test("palisade draft selects a whole run from a nearby edge point", () => {
  // Given / When
  const selected = selectPalisadeRunAtPoint(validCandidate, { x: 9, y: 4 });

  // Then
  assert.equal(selected, 0);
});

test("palisade draft drag moves by whole normal steps and keeps the last valid polygon on failure", () => {
  // Given: the top run is selected and one invalid outward move is requested after a valid move.
  const draft = initialPalisadeDraft(validCandidate);
  const selected = { ...draft, selectedRunIndex: 0 };
  const moved = dragDraftRunByTiles({
    grid,
    draft: selected,
    startTile: { tx: 9, ty: 4 },
    currentTile: { tx: 9, ty: 3 },
    footprints,
  });
  const failed = dragDraftRunByTiles({
    grid,
    draft: moved,
    startTile: { tx: 9, ty: 3 },
    currentTile: { tx: 9, ty: 30 },
    footprints,
  });
  const direct = dragPalisadeRun(grid, validCandidate, 0, 1, footprints);

  // Then
  assert.equal(moved.status, "editing");
  assert.equal(moved.failureReason, null);
  assert.equal(failed.status, "editing");
  assert.equal(failed.failureReason, "out_of_bounds");
  assert.deepEqual(failed.candidate.path, moved.candidate.path);
  assert.equal(direct.ok, true);
  if (direct.ok) assert.deepEqual(moved.candidate.path, direct.candidate.path);
});

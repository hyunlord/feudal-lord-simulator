import assert from "node:assert/strict";
import test from "node:test";

import { BUILD_TOOL_OPTIONS, type PlacementTool } from "../src/ui/buildTools";

test("BUILD_TOOL_OPTIONS exposes all building kinds and road as reachable tools", () => {
  // Given / When
  const ids = BUILD_TOOL_OPTIONS.map((option) => option.id);

  // Then
  assert.deepEqual(ids, [
    "house",
    "well",
    "storehouse",
    "granary",
    "wheat_farm",
    "mill",
    "logging_camp",
    "sawmill",
    "road",
  ] satisfies PlacementTool[]);
  assert.equal(BUILD_TOOL_OPTIONS.every((option) => option.label.length > 0), true);
});

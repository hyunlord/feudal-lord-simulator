import assert from "node:assert/strict";
import test from "node:test";

import { summarizeFrameTimes } from "../scripts/phase4eBenchmarkFixture";

test("Given measured frames When summarized Then average p95 and worst stay independently visible", () => {
  // Given
  const frameTimes = [1, 2, 3, 4, 100];

  // When
  const summary = summarizeFrameTimes(frameTimes);

  // Then
  assert.deepEqual(summary, { averageMs: 22, p95Ms: 100, worstMs: 100 });
});

test("Given unsorted frame times When summarized Then percentile uses numeric order", () => {
  // Given
  const frameTimes = [9, 1, 5, 3];

  // When
  const summary = summarizeFrameTimes(frameTimes);

  // Then
  assert.deepEqual(summary, { averageMs: 4.5, p95Ms: 9, worstMs: 9 });
});

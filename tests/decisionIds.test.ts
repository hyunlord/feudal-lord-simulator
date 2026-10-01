import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { duplicateDecisionIds, formatDecisionIdResult } from "../scripts/checks/decisionIds.mjs";

test("two rows with one decision ID are found with their lines; headers, separators and other rows are not IDs", () => {
  const text = ["| 번호 | 결정 |", "|---|---|", "| RR4 | a |", "| RR5 | b |", "", "| 번호 | 결정 |", "|---|---|", "| RR4 | c |", "| INSTALL27-D1~D4 | d |", "plain RR4 text"].join("\n");
  const duplicates = duplicateDecisionIds(text);
  assert.deepEqual([...duplicates], [["RR4", [3, 8]]]);
  assert.match(formatDecisionIdResult({ duplicates }), /FAILED — 1 duplicated .*\n {2}RR4: lines 3, 8/);
  assert.match(formatDecisionIdResult({ duplicates: new Map() }), /no duplicates/);
});

test("the decision list has no duplicated ID", () => {
  assert.deepEqual([...duplicateDecisionIds(readFileSync("docs/decisions/README.md", "utf8"))], []);
});

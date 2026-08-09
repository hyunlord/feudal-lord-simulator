import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const EVIDENCE_PATH = path.join(REPO_ROOT, "docs/asset-evidence/phase13/final/browser_qa.json");
const SCREENSHOT_ROOT = path.join(REPO_ROOT, "docs/asset-evidence/phase13/final");
const ASSERTIONS_MODULE = new URL("../scripts/phase13FinalBrowserQaAssertions.mjs", import.meta.url);

test("Given the committed Phase 13 publication evidence When verified Then its canonical contract and screenshot bytes remain bound", async () => {
  const parsed: unknown = JSON.parse(await readFile(EVIDENCE_PATH, "utf8"));
  assert.doesNotThrow(assertCanonicalEvidence);

  const evidence = record(parsed, "evidence");
  const screenshots = array(evidence["screenshots"], "screenshots");
  for (const value of screenshots) {
    const screenshot = record(value, "screenshot");
    const relativePath = string(screenshot["path"], "screenshot.path");
    const resolvedPath = path.resolve(REPO_ROOT, relativePath);
    assert.equal(path.dirname(resolvedPath), SCREENSHOT_ROOT, `${relativePath} must stay in the final evidence directory`);
    const bytes = await readFile(resolvedPath);
    assert.equal(bytes.byteLength, number(screenshot["byteLength"], "screenshot.byteLength"));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), string(screenshot["sha256"], "screenshot.sha256"));
  }
});

function assertCanonicalEvidence(): void {
  execFileSync(process.execPath, [
    "--input-type=module",
    "--eval",
    `import { readFileSync } from "node:fs";
     import { assertPhase13FinalBrowserQaEvidence } from ${JSON.stringify(ASSERTIONS_MODULE.href)};
     assertPhase13FinalBrowserQaEvidence(JSON.parse(readFileSync(${JSON.stringify(EVIDENCE_PATH)}, "utf8")));`,
  ]);
}

function record(value: unknown, label: string): Record<string, unknown> {
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value), `${label} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): readonly unknown[] {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  return value;
}

function string(value: unknown, label: string): string {
  assert.equal(typeof value, "string", `${label} must be a string`);
  return value as string;
}

function number(value: unknown, label: string): number {
  assert.equal(typeof value, "number", `${label} must be a number`);
  return value as number;
}

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

const PROOF_SCRIPT = new URL("../scripts/phase8Task10BrowserProof.mjs", import.meta.url);

type ProofRunResult = {
  readonly status: number | null;
  readonly stderr: string;
};

function parseRevisionWith(value: string): string {
  return execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { readProofRevision } from ${JSON.stringify(PROOF_SCRIPT.href)}; process.stdout.write(readProofRevision({ PROOF_REVISION: ${JSON.stringify(value)} }));`,
    ],
    { encoding: "utf8" },
  );
}

function runProofWithRevision(revision: string): ProofRunResult {
  const result = spawnSync(process.execPath, [PROOF_SCRIPT.pathname], {
    encoding: "utf8",
    env: {
      ...process.env,
      CHROME_PATH: "/definitely/missing/chrome",
      PROOF_REVISION: revision,
    },
  });
  return { status: result.status, stderr: result.stderr.toString() };
}

test("readProofRevision accepts an exact 40-hex clean revision", () => {
  // Given
  const revision = "77e8202318cb657a7086b4044f493706c4866bfa";

  // When
  const parsed = parseRevisionWith(revision);

  // Then
  assert.equal(parsed, revision);
});

test("browser proof rejects suffix dirty revision labels before Chrome startup", () => {
  // Given
  const revision = "77e8202318cb657a7086b4044f493706c4866bfa-dirty";

  // When
  const result = runProofWithRevision(revision);

  // Then
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /clean 40-hex revision/);
  assert.doesNotMatch(result.stderr, /ENOENT|spawn/);
});

test("browser proof rejects embedded dirty revision labels before Chrome startup", () => {
  // Given
  const revision = "77e8202318cb657a7086b4044f493706c4866bfadirty";

  // When
  const result = runProofWithRevision(revision);

  // Then
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /clean 40-hex revision/);
  assert.doesNotMatch(result.stderr, /ENOENT|spawn/);
});

test("browser proof rejects unknown revision labels before Chrome startup", () => {
  // Given
  const revision = "unknown";

  // When
  const result = runProofWithRevision(revision);

  // Then
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /clean 40-hex revision/);
  assert.doesNotMatch(result.stderr, /ENOENT|spawn/);
});

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

const BENCHMARK_SCRIPT = new URL("../scripts/phase8Task10BrowserBenchmark.mjs", import.meta.url);

type BenchmarkRunResult = {
  readonly status: number | null;
  readonly stderr: string;
};

function parseRevisionWith(value: string): string {
  return execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { readBenchmarkRevision } from ${JSON.stringify(BENCHMARK_SCRIPT.href)}; process.stdout.write(readBenchmarkRevision({ BENCHMARK_REVISION: ${JSON.stringify(value)} }));`,
    ],
    { encoding: "utf8" },
  );
}

function runBenchmarkWithRevision(revision: string): BenchmarkRunResult {
  const result = spawnSync(process.execPath, [BENCHMARK_SCRIPT.pathname], {
    encoding: "utf8",
    env: {
      ...process.env,
      CHROME_PATH: "/definitely/missing/chrome",
      BENCHMARK_REVISION: revision,
    },
  });
  return { status: result.status, stderr: result.stderr.toString() };
}

test("readBenchmarkRevision accepts an exact 40-hex clean revision", () => {
  const revision = "77e8202318cb657a7086b4044f493706c4866bfa";

  const parsed = parseRevisionWith(revision);

  assert.equal(parsed, revision);
});

test("browser benchmark rejects short revision labels before Chrome startup", () => {
  const result = runBenchmarkWithRevision("abc");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /clean 40-hex revision/);
  assert.doesNotMatch(result.stderr, /ENOENT|spawn/);
});

test("browser benchmark rejects suffix dirty revision labels before Chrome startup", () => {
  const revision = "77e8202318cb657a7086b4044f493706c4866bfa-dirty";

  const result = runBenchmarkWithRevision(revision);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /clean 40-hex revision/);
  assert.doesNotMatch(result.stderr, /ENOENT|spawn/);
});

test("browser benchmark rejects embedded dirty revision labels before Chrome startup", () => {
  const revision = "77e8202318cb657a7086b4044f493706c4866bfadirty";

  const result = runBenchmarkWithRevision(revision);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /clean 40-hex revision/);
  assert.doesNotMatch(result.stderr, /ENOENT|spawn/);
});

test("browser benchmark rejects unknown revision labels before Chrome startup", () => {
  const result = runBenchmarkWithRevision("unknown");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /clean 40-hex revision/);
  assert.doesNotMatch(result.stderr, /ENOENT|spawn/);
});

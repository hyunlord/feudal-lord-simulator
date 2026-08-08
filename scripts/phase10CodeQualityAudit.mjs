import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const FILES_TO_SCAN = [
  "scripts/phase10BrowserProof.mjs",
  "scripts/phase10BrowserProofAssertions.mjs",
  "scripts/phase10BrowserProofCdp.mjs",
  "scripts/phase10BrowserProofRunner.mjs",
  "scripts/phase10ReportLint.mjs",
  "scripts/phase10PlanComplianceAudit.mjs",
  "scripts/phase10ScopeFidelityAudit.mjs",
  "scripts/phase10GlobalGate.mjs",
  "src/testing/phase10ProofRuntime.ts",
  "tests/phase10BrowserProof.test.ts",
  "tests/phase10BrowserProofReview.test.ts",
  "tests/phase10BrowserProofSourceGuard.test.ts",
  "tests/phase10ReportGate.test.ts",
];

const DEBUG_PATTERNS = [
  /debugger;/,
  /console\.log\(\s*["'`]\[DEBUG]/,
  /TODO\s+DEBUG/,
  /HACK\s+DEBUG/,
  /XXX\s+DEBUG/,
];

export function auditPhase10CodeQuality() {
  const errors = [];
  for (const file of FILES_TO_SCAN) {
    const source = readFileSync(file, "utf8");
    if (DEBUG_PATTERNS.some((pattern) => pattern.test(source))) {
      errors.push(`${file} contains debug leftovers`);
    }
  }
  const runtime = readFileSync("src/testing/phase10ProofRuntime.ts", "utf8");
  if (/advanceTicks|advanceTick|commit_simulation_state/.test(runtime)) errors.push("proof runtime exposes direct tick bypass");
  const cdp = readFileSync("scripts/phase10BrowserProofCdp.mjs", "utf8");
  if (!/welcome-dismissed:v1', '1'/.test(cdp)) errors.push("welcome dismissal does not use the application-recognized value");
  const runner = readFileSync("scripts/phase10BrowserProofRunner.mjs", "utf8");
  if (!/performance\.now\(\) - startedAt/.test(runner)) errors.push("frame probe does not measure callback work");
  return { ok: errors.length === 0, scannedFiles: FILES_TO_SCAN.length, errors };
}

if (isDirectRun()) {
  const result = auditPhase10CodeQuality();
  const out = readOut(process.argv.slice(2));
  if (out !== null) await writeJson(out, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

function readOut(argv) {
  const index = argv.indexOf("--out");
  return index >= 0 ? argv[index + 1] ?? null : null;
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function isDirectRun() {
  return process.argv[1] !== undefined && import.meta.url === new URL(process.argv[1], "file:").href;
}

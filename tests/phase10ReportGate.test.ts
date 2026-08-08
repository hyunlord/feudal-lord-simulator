import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = new URL("..", import.meta.url).pathname;
const REPORT_LINT = path.join(ROOT, "scripts/phase10ReportLint.mjs");
const PLAN_AUDIT = path.join(ROOT, "scripts/phase10PlanComplianceAudit.mjs");
const QUALITY_AUDIT = path.join(ROOT, "scripts/phase10CodeQualityAudit.mjs");
const SCOPE_AUDIT = path.join(ROOT, "scripts/phase10ScopeFidelityAudit.mjs");
const GLOBAL_GATE = path.join(ROOT, "scripts/phase10GlobalGate.mjs");
const DEPLOY_PROOF = path.join(ROOT, "scripts/phase10DeployProof.mjs");
const PROOF_SCRIPT = path.join(ROOT, "scripts/phase10BrowserProof.mjs");
const REPORT = path.join(ROOT, "docs/PHASE10_REPORT.md");
const CLEAN_REVISION = "504b0b16e90c94995fada38d2ae38cb0cb54b784";

function evalProofModule(source: string): string {
  return execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", `import * as proof from ${JSON.stringify(new URL(`file://${PROOF_SCRIPT}`).href)}; ${source}`],
    { encoding: "utf8" },
  );
}

function runNode(script: string, args: readonly string[] = []) {
  return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: "utf8" });
}

test("Given Phase10 release tooling Then all final gate entrypoints exist", () => {
  for (const file of [REPORT_LINT, PLAN_AUDIT, QUALITY_AUDIT, SCOPE_AUDIT, GLOBAL_GATE, DEPLOY_PROOF]) {
    assert.equal(existsSync(file), true, `${file} must exist`);
  }
});

test("Given exact plan CLI invocations When executed Then compatibility outputs are produced", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "phase10-plan-cli-"));
  const reportOut = path.join(dir, "report-lint.json");
  const planOut = path.join(dir, "plan-audit.json");
  const qualityOut = path.join(dir, "quality.json");
  const scopeOut = path.join(dir, "scope.json");
  const globalOut = path.join(dir, "global.json");

  assert.equal(runNode(REPORT_LINT, [REPORT, "--exact-sections", "11", "--out", reportOut]).status, 0);
  assert.equal(JSON.parse(readFileSync(reportOut, "utf8")).sectionCount, 11);

  assert.equal(runNode(PLAN_AUDIT, ["--plan", "docs/plans/2026-08-08-phase10-make-it-run-design.md", "--report", REPORT, "--evidence-root", "/tmp/feudal-phase10", "--out", planOut]).status, 0);
  assert.equal(JSON.parse(readFileSync(planOut, "utf8")).ok, true);

  assert.equal(runNode(QUALITY_AUDIT, ["--out", qualityOut]).status, 0);
  assert.equal(JSON.parse(readFileSync(qualityOut, "utf8")).ok, true);

  assert.equal(runNode(SCOPE_AUDIT, ["--plan", "docs/plans/2026-08-08-phase10-make-it-run-design.md", "--report", REPORT, "--out", scopeOut]).status, 0);
  assert.equal(JSON.parse(readFileSync(scopeOut, "utf8")).ok, true);

  assert.equal(runNode(GLOBAL_GATE, ["--report", REPORT, "--evidence-root", "/tmp/feudal-phase10", "--max-review-rounds", "2", "--skip-commands", "--out", globalOut]).status, 0);
  assert.equal(JSON.parse(readFileSync(globalOut, "utf8")).ok, true);
});

test("Given deploy proof resolve-public-url mode When invoked Then only the Pages URL is printed", () => {
  const result = runNode(DEPLOY_PROOF, ["--mode", "resolve-public-url", "--repo", "hyunlord/feudal-lord-simulator"]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "https://hyunlord.github.io/feudal-lord-simulator/");
});

test("Given the Phase10 report When linted without pending placeholders Then exactly eleven required sections are present", () => {
  const result = runNode(REPORT_LINT, ["--report", REPORT]);

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.sectionCount, 11);
  assert.deepEqual(summary.sections.map((section: { title: string }) => section.title), [
    "1. Implemented scope by part and skipped work",
    "2. Why the missing tick loop was not caught",
    "3. Owner decisions",
    "4. Review objections overridden",
    "5. Final walker speeds",
    "6. Part 6 browser screenshots and playthrough",
    "7. Tree and terrain candidate selections",
    "8. Determinism hashes",
    "9. Test output and frame budget",
    "10. Commit hashes and publication proof",
    "11. Public URL honest-read proof",
  ]);
  assert.equal(summary.pendingCount, 0);
});

test("Given a draft report When pending is allowed Then lint permits explicit placeholders only in draft mode", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "phase10-report-"));
  const draft = path.join(dir, "draft.md");
  writeFileSync(draft, [
    "# Draft",
    "",
    "## 1. Implemented scope by part and skipped work",
    "PENDING_PUBLIC_URL",
    "## 2. Why the missing tick loop was not caught",
    "x",
    "## 3. Owner decisions",
    "x",
    "## 4. Review objections overridden",
    "x",
    "## 5. Final walker speeds",
    "x",
    "## 6. Part 6 browser screenshots and playthrough",
    "x",
    "## 7. Tree and terrain candidate selections",
    "x",
    "## 8. Determinism hashes",
    "x",
    "## 9. Test output and frame budget",
    "x",
    "## 10. Commit hashes and publication proof",
    "x",
    "## 11. Public URL honest-read proof",
    "x",
    "",
  ].join("\n"));

  assert.notEqual(runNode(REPORT_LINT, ["--report", draft]).status, 0);
  assert.equal(runNode(REPORT_LINT, ["--report", draft, "--allow-pending"]).status, 0);
});

test("Given final Phase10 evidence When audited Then required commits and Part6 facts are enforced", () => {
  const result = runNode(PLAN_AUDIT, ["--report", REPORT, "--evidence-root", "/tmp/feudal-phase10"]);

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.part6.ticks, 3001);
  assert.equal(summary.part6.frameP95Ms, 6);
  assert.equal(summary.part6.omittedRoadTicks, 601);
});

test("Given Phase10 browser proof args When parsing public honest-read Then no localhost proof port is required", () => {
  const parsed = JSON.parse(evalProofModule(`
    const result = proof.parsePhase10BrowserProofArgs([
      "--scenario", "public-honest-read",
      "--url", "https://hyunlord.github.io/feudal-lord-simulator/",
      "--speed", "1",
      "--watch-ms", "120000",
      "--place-buildings", "2",
      "--out", "/tmp/public.json",
      "--screenshot-dir", "/tmp/public-shots",
      "--revision", ${JSON.stringify(CLEAN_REVISION)}
    ]);
    process.stdout.write(JSON.stringify(result));
  `));

  assert.equal(parsed.scenario, "public-honest-read");
  assert.equal(parsed.watchMs, 120000);
  assert.equal(parsed.placeBuildings, 2);
});

test("Given the exact final-all plan CLI When parsed Then evidence defaults are derived", () => {
  const parsed = JSON.parse(evalProofModule(`
    const result = proof.parsePhase10BrowserProofArgs([
      "--scenario", "final-all",
      "--local-url", "http://127.0.0.1:3200",
      "--public-url", "https://hyunlord.github.io/feudal-lord-simulator/",
      "--evidence-root", "/tmp/feudal-phase10/final",
      "--revision", ${JSON.stringify(CLEAN_REVISION)}
    ]);
    process.stdout.write(JSON.stringify(result));
  `));

  assert.equal(parsed.scenario, "final-all");
  assert.equal(parsed.speed, 1);
  assert.equal(parsed.watchMs, 120000);
  assert.equal(parsed.placeBuildings, 2);
  assert.equal(parsed.out, "/tmp/feudal-phase10/final/final-all.json");
  assert.equal(parsed.screenshotDir, "/tmp/feudal-phase10/final/screens");
});

test("Given the public honest-read runner When inspected Then placement and watch changes are asserted", () => {
  const source = readFileSync(path.join(ROOT, "scripts/phase10BrowserProofRunner.mjs"), "utf8");

  assert.match(source, /openProofPage\(client, config\.url\)/);
  assert.match(source, /assertPlacedKinds\(firstState\.constructionSites, \["logging_camp"\]\)/);
  assert.match(source, /assertPlacedKinds\(secondState\.constructionSites, \["logging_camp", "sawmill"\]\)/);
  assert.match(source, /assertCanvasChanged\(opening\.canvas, firstPlacement\.canvas/);
  assert.match(source, /assertCanvasChanged\(firstPlacement\.canvas, secondPlacement\.canvas/);
  assert.match(source, /assertCanvasChanged\(secondPlacement\.canvas, afterWatch\.canvas/);
});

test("Given final-all When inspected Then every local and public acceptance lane is actually rerun", () => {
  const source = readFileSync(path.join(ROOT, "scripts/phase10BrowserProofRunner.mjs"), "utf8");
  const finalAll = source.slice(source.indexOf("async function runFinalAll"));

  assert.match(finalAll, /runPlaythrough/);
  assert.match(finalAll, /runFrameBudget/);
  assert.match(finalAll, /runViewportAssetQa/);
  assert.match(finalAll, /runPublicHonestRead/);
});

test("Given final gate scripts When inspected Then they do not mutate protected orchestration state", () => {
  for (const script of [REPORT_LINT, PLAN_AUDIT, QUALITY_AUDIT, SCOPE_AUDIT, GLOBAL_GATE, DEPLOY_PROOF]) {
    const source = readFileSync(script, "utf8");
    assert.doesNotMatch(source, /\.omo\/|\.omx\//, `${path.basename(script)} must not write protected state`);
  }
});

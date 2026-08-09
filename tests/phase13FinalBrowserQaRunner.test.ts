import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const QA_SCRIPT = new URL("../scripts/phase13FinalBrowserQa.mjs", import.meta.url);
const MODULES = [
  new URL("../scripts/phase13FinalBrowserQaRunner.mjs", import.meta.url),
  new URL("../scripts/phase13FinalBrowserQaBrowser.mjs", import.meta.url),
  new URL("../scripts/phase13FinalBrowserQaScenarios.mjs", import.meta.url),
  new URL("../scripts/phase13FinalBrowserQaErrors.mjs", import.meta.url),
  new URL("../scripts/phase13FinalBrowserQaFrame.mjs", import.meta.url),
];
const REVISION = "77e8202318cb657a7086b4044f493706c4866bfa";
const PUBLIC_URL = "https://hyunlord.github.io/feudal-lord-simulator/";

function evalQa(source: string): string {
  return execFileSync(process.execPath, ["--input-type=module", "--eval", `import * as qa from ${JSON.stringify(QA_SCRIPT.href)}; ${source}`], {
    encoding: "utf8",
  });
}

function proof(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    workflowRun: { id: 8123456789, html_url: "https://github.com/hyunlord/feudal-lord-simulator/actions/runs/8123456789" },
    deployment: { id: 9123456789, url: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/9123456789" },
    deploymentStatus: { id: 7123456789, url: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/9123456789/statuses/7123456789" },
    pageUrl: PUBLIC_URL,
    capturedAt: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

function proofFile(dir: string, value = proof()): string {
  const file = path.join(dir, "deployment-proof.json");
  writeFileSync(file, JSON.stringify(value));
  return file;
}

function onlineVerificationExpression(): string {
  return `{
    verifiedAt: "2026-08-09T00:00:01.000Z",
    workflowRun: { id: 8123456789, htmlUrl: "https://github.com/hyunlord/feudal-lord-simulator/actions/runs/8123456789", name: "Deploy to GitHub Pages", event: "workflow_dispatch", status: "completed", conclusion: "success", headSha: ${JSON.stringify(REVISION)}, repository: "hyunlord/feudal-lord-simulator" },
    deployment: { id: 9123456789, url: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/9123456789", sha: ${JSON.stringify(REVISION)}, environment: "github-pages", statusesUrl: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/9123456789/statuses" },
    deploymentStatus: { id: 7123456789, url: "https://api.github.com/repos/hyunlord/feudal-lord-simulator/deployments/9123456789/statuses/7123456789", state: "success", environment: "github-pages", environmentUrl: ${JSON.stringify(PUBLIC_URL)}, logUrl: "https://github.com/hyunlord/feudal-lord-simulator/actions/runs/8123456789/job/123" }
  }`;
}

function evidenceExpression(): string {
  return `
    (() => {
    const ids = qa.PHASE13_SCREENSHOT_IDS;
    const responsive = [
      ["opening-1280x720", 1280, 720], ["responsive-920x720", 920, 720], ["responsive-768x1024", 768, 1024], ["responsive-375x812", 375, 812]
    ].map(([id, width, height]) => ({ id, width, height, mobile: false, clipped: [], document: clean(width, height), body: clean(width, height), buildSeals: clean(10, 10), console: clean(10, 10) }));
    function clean(width, height) { return { scrollWidth: width, clientWidth: width, scrollHeight: height, clientHeight: height }; }
    return {
      schemaVersion: 1,
      verdict: "PASS",
      publicUrl: ${JSON.stringify(PUBLIC_URL)},
      revision: ${JSON.stringify(REVISION)},
      deploymentProof: { ...${JSON.stringify(proof())}, onlineVerification: ${onlineVerificationExpression()} },
      loadedResources: [
        { url: ${JSON.stringify(`${PUBLIC_URL}assets/index.js`)}, fetchedUrl: ${JSON.stringify(`${PUBLIC_URL}assets/index.js`)}, kind: "script", status: 200, contentType: "javascript", byteLength: 10, sha256: "a".repeat(64) },
        { url: ${JSON.stringify(`${PUBLIC_URL}assets/index.css`)}, fetchedUrl: ${JSON.stringify(`${PUBLIC_URL}assets/index.css`)}, kind: "stylesheet", status: 200, contentType: "text/css", byteLength: 10, sha256: "b".repeat(64) }
      ],
      screenshots: ids.map((id, index) => ({ id, path: "/tmp/" + index + "-" + id + ".png", byteLength: 10, sha256: "c".repeat(64) })),
      responsive,
      pageInteractions: Array.from({ length: 8 }, (_, index) => ({ atMs: index, label: "dismiss visible welcome guidance", method: "Input.dispatchMouseEvent" })),
      walker: { kind: "roaming", start: { id: "w1", x: 1, y: 1 }, end: { id: "w1", x: 2, y: 1 }, moved: true, focus: { distanceFromCenterPx: 20 } },
      construction: [
        { id: "construction-lte25", siteId: "site-1", siteKind: "house", building: "house", label: "오두막", progress: 0.2, progressText: "48/240틱" },
        { id: "construction-around55", siteId: "site-1", siteKind: "house", building: "house", label: "오두막", progress: 0.55, progressText: "132/240틱" },
        { id: "construction-around85", siteId: "site-1", siteKind: "house", building: "house", label: "오두막", progress: 0.85, progressText: "204/240틱" },
        { id: "construction-complete", siteId: "site-1", siteKind: "house", building: "house", label: "오두막", progress: 1, progressText: "complete", completed: true, houseTile: { tx: 45, ty: 40 }, completedBuildingId: "site-1" }
      ],
      frameProfile: { durationMs: 30000, elapsedMs: 30020, startedAt: 1000, endedAt: 31020, measuredFrameCount: 3, metrics: { minMs: 9, p50Ms: 11, p75Ms: 12, p90Ms: 12, p95Ms: 12, p99Ms: 12, maxMs: 12, avgMs: 11, over16_67: 0, over20: 0 }, failures: [] },
      errors: { console: [], page: [], resource: [], network: [], log: [], runtime: [] }
    };
    })()
  `;
}

test("Given final browser QA CLI args When parsed Then REST proof revision and output defaults are strict", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "phase13-final-qa-test-"));
  const source = proofFile(dir);
  const parsed = JSON.parse(evalQa(`
    const result = qa.parsePhase13FinalBrowserQaArgs(["--public-url", ${JSON.stringify(PUBLIC_URL)}, "--revision", ${JSON.stringify(REVISION)}, "--deployment-proof", ${JSON.stringify(source)}, "--evidence-dir", ${JSON.stringify(dir)}]);
    process.stdout.write(JSON.stringify(result));
  `));

  assert.deepEqual(parsed.deploymentProof, { source, ...proof() });
  assert.equal(parsed.out, path.join(dir, "browser_qa.json"));
  assert.equal(parsed.screenshotDir, path.join(dir, "screens"));
  assert.equal(parsed.frameDurationMs, 30000);
});

test("Given stale revision labels When launching final browser QA Then Chrome is not started", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "phase13-final-qa-test-"));
  const result = spawnSync(process.execPath, [
    QA_SCRIPT.pathname, "--public-url", PUBLIC_URL, "--revision", `${REVISION}+dirty`, "--deployment-proof", proofFile(dir), "--evidence-dir", dir, "--chrome-path", "/definitely/missing/chrome",
  ], { encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /clean 40-hex revision/);
  assert.doesNotMatch(result.stderr, /ENOENT|spawn|GitHub/);
});

test("Given malformed deployment proof When parsing final browser QA Then REST identifiers are enforced", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "phase13-final-qa-test-"));
  const source = proofFile(dir, proof({ pageUrl: "https://example.invalid/" }));
  const output = evalQa(`
    try { qa.parsePhase13FinalBrowserQaArgs(["--public-url", ${JSON.stringify(PUBLIC_URL)}, "--revision", ${JSON.stringify(REVISION)}, "--deployment-proof", ${JSON.stringify(source)}, "--evidence-dir", ${JSON.stringify(dir)}]); }
    catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /pageUrl mismatch|pageUrl/);
});

test("Given complete final QA evidence When asserted Then exact screenshots resources interactions and frame contract are accepted", () => {
  const output = evalQa(`
    const evidence = ${evidenceExpression()};
    process.stdout.write(JSON.stringify(qa.assertPhase13FinalBrowserQaEvidence(evidence)));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given a forged deployment job URL When evidence is asserted Then the GitHub origin and path are rejected", () => {
  const output = evalQa(`
    const evidence = ${evidenceExpression()};
    evidence.deploymentProof.onlineVerification.deploymentStatus.logUrl = "https://evil.invalid/actions/runs/8123456789/job/123";
    try { qa.assertPhase13FinalBrowserQaEvidence(evidence); }
    catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /status logUrl mismatch/);
});

test("Given final QA evidence with duplicate shots or over20 frames When asserted Then it is rejected", () => {
  const output = evalQa(`
    const evidence = ${evidenceExpression()};
    evidence.screenshots[0] = { ...evidence.screenshots[1] };
    evidence.frameProfile.metrics.over20 = 1;
    try { qa.assertPhase13FinalBrowserQaEvidence(evidence); }
    catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /missing screenshots|unique ids|over20|unique paths/);
});

test("Given a completed house with another identity When evidence is asserted Then same-site completion is rejected", () => {
  const output = evalQa(`
    const evidence = ${evidenceExpression()};
    evidence.construction[3].completedBuildingId = "another-site";
    try { qa.assertPhase13FinalBrowserQaEvidence(evidence); }
    catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /completed building identity/);
});

test("Given final QA sources When inspected Then they use public gestures event collection and no simulation bypass", () => {
  const source = MODULES.map((moduleUrl) => readFileSync(moduleUrl, "utf8")).join("\n");

  assert.match(source, /phase10-proof/);
  assert.match(source, /Storage\.clearDataForOrigin/);
  assert.match(source, /자동 발전/);
  assert.match(source, /오두막/);
  assert.match(source, /Runtime\.consoleAPICalled/);
  assert.match(source, /Network\.responseReceived/);
  assert.match(source, /mkdir\(config\.screenshotDir/);
  assert.match(source, /__FEUDAL_PHASE10_PROOF__\.snapshot/);
  assert.match(source, /performance\.getEntriesByType\("resource"\)/);
  assert.doesNotMatch(source, /advanceTick|advanceFrame|gameReducer|commit_simulation_state|status.*active/);
});

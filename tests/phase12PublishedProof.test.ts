import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const PROOF_SCRIPT = new URL("../scripts/phase12PublishedProof.mjs", import.meta.url);
const PROOF_ASSERTIONS = new URL("../scripts/phase12PublishedProofAssertions.mjs", import.meta.url);
const PROOF_BROWSER = new URL("../scripts/phase12PublishedProofBrowser.mjs", import.meta.url);
const PROOF_RUNNER = new URL("../scripts/phase12PublishedProofRunner.mjs", import.meta.url);
const CLEAN_REVISION = "77e8202318cb657a7086b4044f493706c4866bfa";
const PUBLISHED_URL = "https://hyunlord.github.io/feudal-lord-simulator/";

type ProofRunResult = {
  readonly status: number | null;
  readonly stderr: string;
};

function evalProofModule(source: string): string {
  return execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", `import * as proof from ${JSON.stringify(PROOF_SCRIPT.href)}; ${source}`],
    { encoding: "utf8" },
  );
}

function runProofWithRevision(revision: string): ProofRunResult {
  const result = spawnSync(
    process.execPath,
    [
      PROOF_SCRIPT.pathname,
      "--scenario",
      "frame-budget",
      "--out",
      "/tmp/phase12-proof.json",
      "--screenshot-dir",
      "/tmp/phase12-proof-shots",
      "--revision",
      revision,
      "--chrome-path",
      "/definitely/missing/chrome",
    ],
    { encoding: "utf8" },
  );
  return { status: result.status, stderr: result.stderr.toString() };
}

test("Given Part12 proof CLI args When parsing frame budget Then the published URL and 5x thirty-second budget are the defaults", () => {
  const parsed = JSON.parse(evalProofModule(`
    const result = proof.parsePhase12PublishedProofArgs([
      "--scenario", "frame-budget",
      "--out", "/tmp/frame.json",
      "--screenshot-dir", "/tmp/frame-shots",
      "--revision", ${JSON.stringify(CLEAN_REVISION)}
    ]);
    process.stdout.write(JSON.stringify(result));
  `));

  assert.deepEqual(parsed, {
    scenario: "frame-budget",
    url: PUBLISHED_URL,
    speed: 5,
    durationMs: 30000,
    maxFrameMs: 12,
    out: "/tmp/frame.json",
    screenshotDir: "/tmp/frame-shots",
    revision: CLEAN_REVISION,
    revisionSource: "explicit",
    revisionDirty: null,
    chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    chromePort: 9242,
  });
});

test("Given Part12 final proof args When parsed Then every required published scenario is configured", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "phase12-proof-test-"));
  const deploymentProof = path.join(dir, "deployment-proof.json");
  writeFileSync(deploymentProof, JSON.stringify({ url: PUBLISHED_URL, headSha: CLEAN_REVISION, conclusion: "success" }));
  const parsed = JSON.parse(evalProofModule(`
    const result = proof.parsePhase12PublishedProofArgs([
      "--scenario", "final-all",
      "--evidence-root", "/tmp/phase12",
      "--revision", ${JSON.stringify(CLEAN_REVISION)},
      "--deployment-proof", ${JSON.stringify(deploymentProof)}
    ]);
    process.stdout.write(JSON.stringify(result));
  `));

  assert.equal(parsed.scenario, "final-all");
  assert.equal(parsed.url, PUBLISHED_URL);
  assert.equal(parsed.pressPlayDurationMs, 30000);
  assert.equal(parsed.guidedDurationMs, 300000);
  assert.equal(parsed.autoplayDurationMs, 600000);
  assert.equal(parsed.honestDurationMs, 60000);
  assert.equal(parsed.frameBudgetDurationMs, 30000);
  assert.equal(parsed.out, "/tmp/phase12/final-all.json");
  assert.equal(parsed.screenshotDir, "/tmp/phase12/screens");
  assert.deepEqual(parsed.deploymentProof, {
    source: deploymentProof,
    url: PUBLISHED_URL,
    headSha: CLEAN_REVISION,
    conclusion: "success",
  });
});

test("Given stale revision labels When launching the Part12 proof CLI Then Chrome is not started", () => {
  const result = runProofWithRevision(`${CLEAN_REVISION}+dirty`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /clean 40-hex revision/);
  assert.doesNotMatch(result.stderr, /ENOENT|spawn/);
});

test("Given a thirty-second published play observation When asserted Then movement resources and exact screenshots are required", () => {
  const output = evalProofModule(`
    const result = proof.assertPressPlayThirtySecondEvidence({
      elapsedMs: 30010,
      initialWalkerHash: "walkers-a",
      tenSecondWalkerHash: "walkers-b",
      finalWalkerHash: "walkers-c",
      resourceChanged: true,
      visibleActivityBy10s: true,
      blankCanvas: false,
      missingAssets: [],
      screenshots: ["fresh", "play-10s", "play-30s"]
    });
    process.stdout.write(JSON.stringify(result));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given fabricated play evidence When walkers do not move by ten seconds Then Part1 failure is reported", () => {
  const output = evalProofModule(`
    try {
      proof.assertPressPlayThirtySecondEvidence({
        elapsedMs: 30010,
        initialWalkerHash: "same",
        tenSecondWalkerHash: "same",
        finalWalkerHash: "same",
        resourceChanged: true,
        visibleActivityBy10s: false,
        blankCanvas: false,
        missingAssets: [],
        screenshots: ["fresh", "play-10s", "play-30s"]
      });
    } catch (error) {
      process.stdout.write(error instanceof Error ? error.message : String(error));
    }
  `);

  assert.match(output, /Part 1 failed/);
});

test("Given a guided five-minute proof When asserted Then final population and guess moments are explicit", () => {
  const output = evalProofModule(`
    const result = proof.assertGuidedFiveMinuteEvidence({
      elapsedMs: 300001,
      finalPopulation: 18,
      actions: [{ atMs: 1200, label: "길 배치", reason: "guidance requested road", outcome: "road accepted" }],
      guesses: [{ atMs: 9000, prompt: "배치 위치", decision: "nearest road edge", reason: "guidance lacked exact tile" }],
      screenshots: ["guided-start", "guided-final"],
      blankCanvas: false,
      missingAssets: []
    });
    process.stdout.write(JSON.stringify(result));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given autoplay ten-minute evidence When asserted Then population curve build order and bad-advisor flags are required", () => {
  const output = evalProofModule(`
    const result = proof.assertAutoplayTenMinuteEvidence({
      elapsedMs: 600001,
      populationCurve: [{ atMs: 0, population: 12 }, { atMs: 600000, population: 16 }],
      buildOrder: [
        { atMs: 0, label: "밀밭", kind: "wheat_farm", tx: 6, ty: 6 },
        { atMs: 120000, label: "방앗간", kind: "mill", tx: 8, ty: 6 }
      ],
      sensibility: { sensible: true, wrongChoices: [] },
      screenshots: ["autoplay-start", "autoplay-final"],
      blankCanvas: false,
      missingAssets: []
    });
    process.stdout.write(JSON.stringify(result));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given autoplay evidence that builds a mill before wheat Then the wrong sequence is rejected", () => {
  const output = evalProofModule(`
    try {
      proof.assertAutoplayTenMinuteEvidence({
        elapsedMs: 600001,
        populationCurve: [{ atMs: 0, population: 12 }, { atMs: 600000, population: 12 }],
        buildOrder: [{ atMs: 0, label: "방앗간", kind: "mill", tx: 8, ty: 6 }],
        sensibility: { sensible: true, wrongChoices: [] },
        screenshots: ["autoplay-start", "autoplay-final"],
        blankCanvas: false,
        missingAssets: []
      });
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /mill before wheat farm/);
});

test("Given honest untouched one-minute evidence When asserted Then it records the untouched published read separately", () => {
  const output = evalProofModule(`
    const result = proof.assertHonestOneMinuteEvidence({
      elapsedMs: 60000,
      interactions: 0,
      screenshots: ["honest-start", "honest-60s"],
      blankCanvas: false,
      missingAssets: []
    });
    process.stdout.write(JSON.stringify(result));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given the Part12 runner source When inspecting automation Then it uses browser-observed time and no direct tick bypass", () => {
  const runner = `${readFileSync(PROOF_RUNNER, "utf8")}\n${readFileSync(PROOF_BROWSER, "utf8")}`;
  const assertions = readFileSync(PROOF_ASSERTIONS, "utf8");

  assert.doesNotMatch(runner, /advanceTick|advanceFrame|gameReducer|commit_simulation_state/);
  assert.match(runner, /performance\.now\(\) - startedAt/);
  assert.match(runner, /Page\.captureScreenshot/);
  assert.match(runner, /자동 발전/);
  assert.match(assertions, /mill before wheat farm/);
});

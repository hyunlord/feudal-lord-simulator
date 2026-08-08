import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

import { phase10ProofEnabled } from "../src/testing/phase10ProofRuntime";

const PROOF_SCRIPT = new URL("../scripts/phase10BrowserProof.mjs", import.meta.url);
const CLEAN_REVISION = "77e8202318cb657a7086b4044f493706c4866bfa";

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
      "part6-playthrough",
      "--url",
      "http://127.0.0.1:3200",
      "--speed",
      "1",
      "--ticks",
      "3000",
      "--out",
      "/tmp/phase10-proof.json",
      "--screenshot-dir",
      "/tmp/phase10-proof-shots",
      "--revision",
      revision,
      "--chrome-path",
      "/definitely/missing/chrome",
    ],
    { encoding: "utf8" },
  );
  return { status: result.status, stderr: result.stderr.toString() };
}

test("Given localhost proof opt-in When checking the runtime hook gate Then only phase10-proof=1 enables it", () => {
  assert.equal(phase10ProofEnabled({ hostname: "127.0.0.1", search: "?phase10-proof=1" }), true);
  assert.equal(phase10ProofEnabled({ hostname: "localhost", search: "?phase10-proof=1" }), true);
  assert.equal(phase10ProofEnabled({ hostname: "127.0.0.1", search: "" }), false);
  assert.equal(phase10ProofEnabled({ hostname: "example.com", search: "?phase10-proof=1" }), false);
});

test("Given the Part6 CLI contract When parsing playthrough args Then the exact scenario shape is accepted", () => {
  const parsed = evalProofModule(`
    const result = proof.parsePhase10BrowserProofArgs([
      "--scenario", "part6-playthrough",
      "--url", "http://127.0.0.1:3200",
      "--speed", "1",
      "--ticks", "3000",
      "--out", "/tmp/out.json",
      "--screenshot-dir", "/tmp/screens",
      "--revision", ${JSON.stringify(CLEAN_REVISION)}
    ]);
    process.stdout.write(JSON.stringify(result));
  `);

  assert.deepEqual(JSON.parse(parsed), {
    scenario: "part6-playthrough",
    url: "http://127.0.0.1:3200",
    speed: 1,
    ticks: 3000,
    durationMs: null,
    maxFrameMs: 12,
    out: "/tmp/out.json",
    screenshotDir: "/tmp/screens",
    revision: CLEAN_REVISION,
    revisionSource: "explicit",
    revisionDirty: null,
    chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    chromePort: 9236,
  });
});

test("Given the Part6 CLI contract When parsing frame budget args Then speed five and thirty seconds are required", () => {
  const parsed = evalProofModule(`
    const result = proof.parsePhase10BrowserProofArgs([
      "--scenario", "frame-budget",
      "--url", "http://127.0.0.1:3200",
      "--speed", "5",
      "--duration-ms", "30000",
      "--max-frame-ms", "12",
      "--out", "/tmp/frame.json",
      "--screenshot-dir", "/tmp/frame-shots",
      "--revision", ${JSON.stringify(CLEAN_REVISION)}
    ]);
    process.stdout.write(JSON.stringify(result));
  `);

  assert.deepEqual(JSON.parse(parsed), {
    scenario: "frame-budget",
    url: "http://127.0.0.1:3200",
    speed: 5,
    ticks: null,
    durationMs: 30000,
    maxFrameMs: 12,
    out: "/tmp/frame.json",
    screenshotDir: "/tmp/frame-shots",
    revision: CLEAN_REVISION,
    revisionSource: "explicit",
    revisionDirty: null,
    chromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    chromePort: 9236,
  });
});

test("Given stale revision labels When launching the proof CLI Then Chrome is not started", () => {
  const result = runProofWithRevision(`${CLEAN_REVISION}-dirty`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /clean 40-hex revision/);
  assert.doesNotMatch(result.stderr, /ENOENT|spawn/);
});

test("Given a successful playthrough snapshot When asserted Then Part6 production facts are required", () => {
  const output = evalProofModule(`
    const summary = proof.assertPart6Playthrough({
      tick: 3000,
      loopObservedTicks: 3000,
      initialPopulation: 12,
      finalPopulation: 13,
      walkerStartHash: "a",
      walkerFinalHash: "b",
      logsCarter: { kind: "carter", phase: "outbound", cargo: { resource: "logs", amount: 2 } },
      logsTransferred: 4,
      timberAccumulated: 2,
      screenshots: ["fresh", "placement", "road", "walker", "goods", "final"],
      renderHash: "feedbeef",
      missingAssets: [],
      blankCanvas: false
    });
    process.stdout.write(JSON.stringify(summary));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given an omitted-road snapshot When asserted Then buildings persist and remain idle with the exact marker", () => {
  const output = evalProofModule(`
    const summary = proof.assertOmittedRoadFlow({
      tick: 600,
      placedKinds: ["logging_camp", "sawmill"],
      placementState: "construction_sites_persisted",
      roadsEverPlaced: false,
      initialRoadRevision: 0,
      finalRoadRevision: 0,
      markerProof: { marker: "🚧 길이 필요합니다" },
      carterCount: 0,
      goodsDelta: 0,
      productionDelta: 0,
      screenshots: ["omitted-road-placement", "omitted-road-idle"]
    });
    process.stdout.write(JSON.stringify(summary));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given frame timings When summarized Then p95 must stay under the configured budget", () => {
  const output = evalProofModule(`
    const summary = proof.summarizeFrameBudget([7, 8, 9, 10, 11, 11.5], 12);
    process.stdout.write(JSON.stringify(summary));
  `);

  assert.deepEqual(JSON.parse(output), {
    ok: true,
    averageMs: 9.416666666666666,
    p95Ms: 11.5,
    worstMs: 11.5,
    measuredFrames: 6,
    overBudgetFrames: 0
  });
});

test("Given fabricated playthrough evidence When asserted Then missing screenshots are rejected", () => {
  const output = evalProofModule(`
    try {
      proof.assertPart6Playthrough({
        tick: 3000,
        loopObservedTicks: 3000,
        initialPopulation: 12,
        finalPopulation: 10,
        walkerStartHash: "a",
        walkerFinalHash: "b",
        logsCarter: { kind: "carter", phase: "outbound", cargo: { resource: "logs", amount: 2 } },
        logsTransferred: 4,
        timberAccumulated: 2,
        screenshots: ["fresh"],
        renderHash: "feedbeef",
        missingAssets: [],
        blankCanvas: false
      });
    } catch (error) {
      process.stdout.write(error instanceof Error ? error.message : String(error));
    }
  `);

  assert.match(output, /missing screenshots/);
});

test("Given fabricated omitted-road evidence When asserted Then the exact marker and idle economy are required", () => {
  const output = evalProofModule(`
    try {
      proof.assertOmittedRoadFlow({
        tick: 600,
        placedKinds: ["logging_camp", "sawmill"],
        placementState: "construction_sites_persisted",
        roadsEverPlaced: false,
        initialRoadRevision: 0,
        finalRoadRevision: 0,
        markerProof: { marker: "길 없음" },
        carterCount: 0,
        goodsDelta: 0,
        productionDelta: 0,
        screenshots: ["omitted-road-placement", "omitted-road-idle"]
      });
    } catch (error) {
      process.stdout.write(error instanceof Error ? error.message : String(error));
    }
  `);

  assert.match(output, /missing exact road marker/);
});

test("Given over-budget frame timings When summarized Then the verdict is not ok", () => {
  const output = evalProofModule(`
    const summary = proof.summarizeFrameBudget([7, 8, 9, 20, 21], 12);
    process.stdout.write(JSON.stringify(summary));
  `);

  assert.equal(JSON.parse(output).ok, false);
});

test("Given a browser playthrough that bypassed the live 1x loop When asserted Then the evidence is rejected", () => {
  const output = evalProofModule(`
    try {
      proof.assertPart6Playthrough({
        tick: 3000,
        loopObservedTicks: 0,
        initialPopulation: 12,
        finalPopulation: 13,
        walkerStartHash: "a",
        walkerFinalHash: "b",
        logsCarter: { kind: "carter", phase: "outbound", cargo: { resource: "logs", amount: 2 } },
        logsTransferred: 4,
        timberAccumulated: 2,
        screenshots: ["fresh", "placement", "road", "walker", "goods", "final"],
        renderHash: "feedbeef",
        missingAssets: [],
        blankCanvas: false
      });
    } catch (error) {
      process.stdout.write(error instanceof Error ? error.message : String(error));
    }
  `);

  assert.match(output, /live 1x loop/);
});

test("Given omitted-road production changed during the measured window When asserted Then the evidence is rejected", () => {
  const output = evalProofModule(`
    try {
      proof.assertOmittedRoadFlow({
        tick: 600,
        placedKinds: ["logging_camp", "sawmill"],
        placementState: "construction_sites_persisted",
        roadsEverPlaced: false,
        initialRoadRevision: 0,
        finalRoadRevision: 0,
        markerProof: { marker: "🚧 길이 필요합니다" },
        carterCount: 0,
        goodsDelta: 0,
        productionDelta: 1,
        screenshots: ["omitted-road-placement", "omitted-road-idle"]
      });
    } catch (error) {
      process.stdout.write(error instanceof Error ? error.message : String(error));
    }
  `);

  assert.match(output, /omitted-road economy moved/);
});

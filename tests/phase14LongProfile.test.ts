import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const PROFILE_CLI = new URL("../scripts/phase14LongProfile.mjs", import.meta.url);
const PROFILE_ASSERTIONS = new URL("../scripts/phase14LongProfileAssertions.mjs", import.meta.url);
const PROFILE_BROWSER = new URL("../scripts/phase14LongProfileBrowser.mjs", import.meta.url);

const CLEAN_REVISION = "77e8202318cb657a7086b4044f493706c4866bfa";
const HASH = "a".repeat(64);

function evalProfile(source: string): string {
  return execFileSync(process.execPath, ["--input-type=module", "--eval", `import * as profile from ${JSON.stringify(PROFILE_CLI.href)}; ${source}`], {
    encoding: "utf8",
  });
}

function checkpoint(minute: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const targetElapsedMs = minute * 60_000;
  return {
    minute,
    targetElapsedMs,
    windowStartMs: targetElapsedMs - 60_000,
    windowDurationMs: 60_000,
    elapsedMs: targetElapsedMs + 120,
    tick: minute * 6_000,
    snapshotCounts: { buildings: 8 + minute, houses: 4 + minute, walkers: 4 + minute, constructionSites: 1 },
    heapUsage: { usedSize: 10_000_000 + minute, totalSize: 20_000_000 + minute },
    performanceMetrics: [{ name: "JSHeapUsedSize", value: 10_000_000 + minute }],
    frame: { sampleCount: 3_500, avgMs: 4 + minute / 100, p95Ms: 7 + minute / 100, maxMs: 12, over20: 0 },
    screenshot: { path: `/tmp/phase14-long-profile/minute-${minute}.png`, byteLength: 12_000 + minute, sha256: HASH },
    failures: { console: [], page: [], network: [], resource: [], log: [], runtime: [] },
    ...overrides,
  };
}

function evidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    verdict: "PASS",
    url: "http://127.0.0.1:4173/",
    revision: CLEAN_REVISION,
    revisionSource: "git",
    revisionDirty: false,
    initialSnapshot: {
      tick: 0,
      snapshotCounts: { buildings: 8, houses: 4, walkers: 4, constructionSites: 0 },
    },
    controls: {
      welcomeDismissed: true,
      playPressed: true,
      fivefoldPressed: true,
      autoplayPressed: true,
      fivefoldAriaPressed: "true",
      autoplayAriaPressed: "true",
      visibility: "visible",
      activeElement: "autoplay",
      documentVisibilityState: "visible",
      documentHasFocus: true,
    },
    checkpoints: [checkpoint(1), checkpoint(3), checkpoint(5), checkpoint(7), checkpoint(10)],
    errors: { console: [], page: [], network: [], resource: [], log: [], runtime: [] },
    ...overrides,
  };
}

test("Given complete long profile evidence When asserted Then checkpoint screenshots density and ten-minute stability are accepted", () => {
  const output = evalProfile(`
    const evidence = ${JSON.stringify(evidence())};
    process.stdout.write(JSON.stringify(profile.assertPhase14LongProfileEvidence(evidence)));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given forged screenshots or inexact checkpoints When asserted Then evidence objects and elapsed accuracy are required", () => {
  const output = evalProfile(`
    const evidence = ${JSON.stringify(evidence({
      checkpoints: [checkpoint(1), checkpoint(3), checkpoint(5), checkpoint(7), checkpoint(10)],
    }))};
    evidence.checkpoints[2].screenshot = "minute-5.png";
    evidence.checkpoints[3].elapsedMs = evidence.checkpoints[3].targetElapsedMs + 5_000;
    evidence.checkpoints[1].windowDurationMs = 120_000;
    try { profile.assertPhase14LongProfileEvidence(evidence); }
    catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /screenshot object|elapsed|windowDurationMs/);
});

test("Given a hidden or unfocused page When asserted Then foreground execution is rejected", () => {
  const output = evalProfile(`
    const evidence = ${JSON.stringify(evidence())};
    evidence.controls.documentVisibilityState = "hidden";
    evidence.controls.documentHasFocus = false;
    try { profile.assertPhase14LongProfileEvidence(evidence); }
    catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /document visibility|document focus/);
});

test("Given stalled or regressed minute ten data When asserted Then simulation progress frame density and 1.2x budget are enforced", () => {
  const output = evalProfile(`
    const evidence = ${JSON.stringify(evidence())};
    evidence.checkpoints[4].tick = evidence.checkpoints[3].tick;
    evidence.checkpoints[4].frame.sampleCount = 10;
    evidence.checkpoints[4].frame.avgMs = 8;
    evidence.checkpoints[4].frame.p95Ms = 12;
    try { profile.assertPhase14LongProfileEvidence(evidence); }
    catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /tick must advance|frame density|minute10/);
});

test("Given a genuine ten-minute autoplay profile When asserted Then the settlement must grow from its initial snapshot", () => {
  const output = evalProfile(`
    const evidence = ${JSON.stringify(evidence())};
    evidence.checkpoints.forEach((entry) => {
      entry.snapshotCounts.buildings = evidence.initialSnapshot.snapshotCounts.buildings;
      entry.snapshotCounts.houses = evidence.initialSnapshot.snapshotCounts.houses;
    });
    try { profile.assertPhase14LongProfileEvidence(evidence); }
    catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /settlement must grow/);
});

test("Given zero baseline frame metrics When minute ten is nonzero Then the zero-safe ratio fails explicitly", () => {
  const output = evalProfile(`
    const evidence = ${JSON.stringify(evidence({
      checkpoints: [
        checkpoint(1, { frame: { sampleCount: 3_500, avgMs: 0, p95Ms: 0, maxMs: 0, over20: 0 } }),
        checkpoint(3),
        checkpoint(5),
        checkpoint(7),
        checkpoint(10, { frame: { sampleCount: 3_500, avgMs: 0.1, p95Ms: 0.1, maxMs: 1, over20: 0 } }),
      ],
    }))};
    try { profile.assertPhase14LongProfileEvidence(evidence); }
    catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /zero baseline/);
});

test("Given frame callback samples When summarized Then callbacks sharing a timestamp are summed into one frame", () => {
  const output = evalProfile(`
    const result = profile.summarizePhase14CallbackSamples([
      { frameTimestamp: 100, callbackWorkMs: 2 },
      { frameTimestamp: 100, callbackWorkMs: 3 },
      { frameTimestamp: 116, callbackWorkMs: 4 },
      { frameTimestamp: 132, callbackWorkMs: 25 },
    ]);
    process.stdout.write(JSON.stringify(result));
  `);
  const result = JSON.parse(output);

  assert.equal(result.sampleCount, 3);
  assert.equal(result.avgMs, 34 / 3);
  assert.equal(result.p95Ms, 25);
  assert.equal(result.maxMs, 25);
  assert.equal(result.over20, 1);
});

test("Given omitted revision When config is parsed Then git HEAD plus dirty state becomes the revision source", () => {
  const output = evalProfile(`
    const result = profile.resolvePhase14Revision({
      revision: null,
      repoRoot: "/repo",
      execFileSync: (bin, args) => args[0] === "rev-parse" ? ${JSON.stringify(CLEAN_REVISION)} + "\\n" : " M src/render/GameCanvas.tsx\\n",
    });
    process.stdout.write(JSON.stringify(result));
  `);

  assert.deepEqual(JSON.parse(output), {
    revision: `${CLEAN_REVISION}+dirty`,
    revisionSource: "git",
    revisionDirty: true,
  });
});

test("Given dirty revision provenance When release evidence is asserted Then it is rejected", () => {
  const output = evalProfile(`
    const evidence = ${JSON.stringify(evidence({
      revision: `${CLEAN_REVISION}+dirty`,
      revisionDirty: true,
    }))};
    try { profile.assertPhase14LongProfileEvidence(evidence); }
    catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /clean 40-hex revision/);
});

test("Given long profile sources When inspected Then they use real CDP UI controls and no simulation bypass", () => {
  const source = [PROFILE_CLI, PROFILE_ASSERTIONS, PROFILE_BROWSER].map((moduleUrl) => readFileSync(moduleUrl, "utf8")).join("\n");

  assert.match(source, /Page\.addScriptToEvaluateOnNewDocument/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /window\.__PHASE14_CALLBACK_SAMPLES__\.push/);
  assert.doesNotMatch(source, /const callbackSamples = \[\]/);
  assert.match(source, /welcome-dismiss-layer/);
  assert.match(source, /Input\.dispatchMouseEvent/);
  assert.match(source, /1배속/);
  assert.match(source, /5배속/);
  assert.match(source, /자동 발전/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /document\.activeElement/);
  assert.match(source, /document\.visibilityState/);
  assert.match(source, /document\.hasFocus\(\)/);
  assert.match(source, /--disable-background-timer-throttling/);
  assert.doesNotMatch(source, /--headless/);
  assert.match(source, /Runtime\.getHeapUsage/);
  assert.match(source, /Performance\.getMetrics/);
  assert.match(source, /__FEUDAL_PHASE10_PROOF__\.snapshot/);
  assert.doesNotMatch(source, /advanceTick|advanceFrame|gameReducer|commit_simulation_state|dispatch\(\{/);
});

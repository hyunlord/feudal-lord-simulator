import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const PROOF_SCRIPT = new URL("../scripts/phase12PublishedProof.mjs", import.meta.url);
const PROOF_ASSERTIONS = new URL("../scripts/phase12PublishedProofAssertions.mjs", import.meta.url);
const PROOF_BROWSER = new URL("../scripts/phase12PublishedProofBrowser.mjs", import.meta.url);
const PROOF_RUNNER = new URL("../scripts/phase12PublishedProofRunner.mjs", import.meta.url);
const PROOF_SCENARIOS = new URL("../scripts/phase12PublishedProofScenarios.mjs", import.meta.url);
const PROOF_LONG_SCENARIOS = new URL("../scripts/phase12PublishedProofLongScenarios.mjs", import.meta.url);
const CLEAN_REVISION = "77e8202318cb657a7086b4044f493706c4866bfa";
const PUBLISHED_URL = "https://hyunlord.github.io/feudal-lord-simulator/";

function evalProofModule(source: string): string {
  return execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", `import * as proof from ${JSON.stringify(PROOF_SCRIPT.href)}; ${source}`],
    { encoding: "utf8" },
  );
}

test("Given final-all without deployment proof When parsed Then the published revision is rejected as unbound", () => {
  const output = evalProofModule(`
    try {
      proof.parsePhase12PublishedProofArgs([
        "--scenario", "final-all",
        "--evidence-root", "/tmp/phase12",
        "--revision", ${JSON.stringify(CLEAN_REVISION)}
      ]);
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /deployment-proof/);
});

test("Given deployment proof JSON When parsed Then URL headSha and success conclusion bind the published build", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "phase12-deploy-proof-"));
  const proofPath = path.join(dir, "proof.json");
  writeFileSync(proofPath, JSON.stringify({ url: PUBLISHED_URL, headSha: CLEAN_REVISION, conclusion: "success" }));
  const parsed = JSON.parse(evalProofModule(`
    const result = proof.parsePhase12PublishedProofArgs([
      "--scenario", "final-all",
      "--evidence-root", "/tmp/phase12",
      "--revision", ${JSON.stringify(CLEAN_REVISION)},
      "--deployment-proof", ${JSON.stringify(proofPath)}
    ]);
    process.stdout.write(JSON.stringify(result.deploymentProof));
  `));

  assert.deepEqual(parsed, { source: proofPath, url: PUBLISHED_URL, headSha: CLEAN_REVISION, conclusion: "success" });
});

test("Given press-play screenshots When asserted Then ten and thirty second shot timestamps are tight after Play", () => {
  const output = evalProofModule(`
    const result = proof.assertPressPlayThirtySecondEvidence({
      elapsedMs: 30050,
      initialWalkerHash: "a",
      tenSecondWalkerHash: "b",
      finalWalkerHash: "c",
      resourceChanged: true,
      visibleActivityBy10s: true,
      blankCanvas: false,
      missingAssets: [],
      screenshots: [
        { label: "fresh", atMs: 0 },
        { label: "play-10s", atMs: 10040 },
        { label: "play-30s", atMs: 30050 }
      ]
    });
    process.stdout.write(JSON.stringify(result));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given loose press-play timing When asserted Then pre-Play anchored timestamps are rejected", () => {
  const output = evalProofModule(`
    try {
      proof.assertPressPlayThirtySecondEvidence({
        elapsedMs: 30050,
        initialWalkerHash: "a",
        tenSecondWalkerHash: "b",
        finalWalkerHash: "c",
        resourceChanged: true,
        visibleActivityBy10s: true,
        blankCanvas: false,
        missingAssets: [],
        screenshots: [
          { label: "fresh", atMs: 0 },
          { label: "play-10s", atMs: 24000 },
          { label: "play-30s", atMs: 44000 }
        ]
      });
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /play-10s timestamp/);
});

test("Given guided proof actions When asserted Then every action carries a dedicated DOM source and observable state delta", () => {
  const output = evalProofModule(`
    const result = proof.assertGuidedFiveMinuteEvidence({
      elapsedMs: 300001,
      finalPopulation: 18,
      actions: [{
        atMs: 1200,
        label: "길",
        source: "onboarding-task-current",
        gesture: "road-drag",
        before: { roadRevision: 14, buildings: 4, constructionSites: 0 },
        after: { roadRevision: 15, buildings: 4, constructionSites: 0 },
        outcome: "roadRevision changed"
      }],
      guesses: [],
      screenshots: ["guided-start", "guided-final"],
      blankCanvas: false,
      missingAssets: []
    });
    process.stdout.write(JSON.stringify(result));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given autoplay proof evidence When asserted Then action order includes pulses roads buildings and proclamations", () => {
  const output = evalProofModule(`
    const result = proof.assertAutoplayTenMinuteEvidence({
      elapsedMs: 600001,
      populationCurve: [{ atMs: 0, population: 12 }, { atMs: 600000, population: 16 }],
      actionOrder: [
        { atMs: 1000, kind: "place_road", label: "길 연결", before: { roadRevision: 14 }, after: { roadRevision: 15 }, pulse: { message: "다음: 길 연결" } },
        { atMs: 121000, kind: "place_building", building: "wheat_farm", label: "밀밭", before: { constructionSites: 0 }, after: { constructionSites: 1 }, pulse: { message: "다음: 밀밭 건설" } },
        { atMs: 241000, kind: "proclaim_era", label: "시대 선포", before: { era: "hamlet" }, after: { era: "palisade" }, pulse: null }
      ],
      sensibility: { sensible: true, wrongChoices: [], derivedFrom: "advisorCommits" },
      screenshots: ["autoplay-start", "autoplay-final"],
      blankCanvas: false,
      missingAssets: []
    });
    process.stdout.write(JSON.stringify(result));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given autoplay road evidence without road revision change When asserted Then road-to-nowhere is rejected", () => {
  const output = evalProofModule(`
    try {
      proof.assertAutoplayTenMinuteEvidence({
        elapsedMs: 600001,
        populationCurve: [{ atMs: 0, population: 12 }, { atMs: 600000, population: 12 }],
        actionOrder: [{ atMs: 1000, kind: "place_road", label: "길 연결", before: { roadRevision: 14 }, after: { roadRevision: 14 }, pulse: { message: "다음: 길 연결" } }],
        sensibility: { sensible: true, wrongChoices: [], derivedFrom: "advisorCommits" },
        screenshots: ["autoplay-start", "autoplay-final"],
        blankCanvas: false,
        missingAssets: []
      });
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /road-to-nowhere/);
});

test("Given advisor commit order with mill before wheat When asserted Then the new action schema is rejected", () => {
  const output = evalProofModule(`
    try {
      proof.assertAutoplayTenMinuteEvidence({
        elapsedMs: 600001,
        populationCurve: [{ atMs: 0, population: 12 }, { atMs: 600000, population: 12 }],
        actionOrder: [{
          atMs: 1000, kind: "place_building", building: "mill", label: "방앗간",
          before: { constructionSites: 0, buildings: 4 }, after: { constructionSites: 1, buildings: 4 },
          pulse: { message: "다음: 방앗간 건설" }
        }],
        sensibility: { sensible: false, wrongChoices: ["mill before wheat farm"], derivedFrom: "advisorCommits" },
        screenshots: ["autoplay-start", "autoplay-final"], blankCanvas: false, missingAssets: []
      });
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);

  assert.match(output, /mill before wheat farm/);
});

test("Given honest fresh proof with setup interactions When asserted Then it is not called untouched", () => {
  const output = evalProofModule(`
    const result = proof.assertHonestOneMinuteEvidence({
      elapsedMs: 60000,
      untouched: false,
      setupInteractions: [{ atMs: 0, label: "visible play", reason: "start simulation from true fresh page" }],
      screenshots: ["honest-start", "honest-60s"],
      blankCanvas: false,
      missingAssets: []
    });
    process.stdout.write(JSON.stringify(result));
  `);

  assert.equal(JSON.parse(output).ok, true);
});

test("Given the published frame budget scenario When inspected Then it does not overwrite the probe-owned frame array", () => {
  const source = readFileSync(PROOF_SCENARIOS, "utf8");

  assert.doesNotMatch(source, /window\.__PHASE12_FRAME_TIMES__ = \[\]/);
  assert.match(source, /window\.__PHASE12_FRAME_TIMES__ \?\? \[\]/);
});

test("Given source review When inspecting round2 implementation Then it avoids whole-body guidance and welcome dismissal injection", () => {
  const source = [PROOF_RUNNER, PROOF_BROWSER, PROOF_SCENARIOS, PROOF_LONG_SCENARIOS]
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  const assertions = readFileSync(PROOF_ASSERTIONS, "utf8");

  assert.doesNotMatch(source, /document\.body\.innerText/);
  assert.doesNotMatch(source, /openHonestPage/);
  assert.doesNotMatch(source, /welcome-dismissed/);
  assert.match(source, /onboarding-task--current|settlement-status/);
  assert.match(source, /Input\.dispatchMouseEvent/);
  assert.match(source, /feudal-lord-simulator:autoplay-pulse/);
  assert.match(assertions, /derivedFrom/);
});

test("Given every published scenario When navigating fresh Then visible welcome dismissal is recorded without the legacy injected opener", () => {
  const source = [PROOF_BROWSER, PROOF_SCENARIOS, PROOF_LONG_SCENARIOS]
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /openProofPage/);
  assert.match(source, /Storage\.clearDataForOrigin/);
  assert.match(source, /\.welcome-dismiss-layer/);
  assert.match(source, /setupInteractions/);
});

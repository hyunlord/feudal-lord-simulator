import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

const PROOF_SCRIPT = new URL("../scripts/phase10BrowserProof.mjs", import.meta.url);

function evalProofModule(source: string): string {
  return execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", `import * as proof from ${JSON.stringify(PROOF_SCRIPT.href)}; ${source}`],
    { encoding: "utf8" },
  );
}

test("Given the exact plan CLI without revision When parsed Then truthful git provenance is derived", () => {
  const parsed = JSON.parse(evalProofModule(`
    const result = proof.parsePhase10BrowserProofArgs([
      "--scenario", "part6-playthrough", "--url", "http://127.0.0.1:3200",
      "--speed", "1", "--ticks", "3000", "--out", "/tmp/out.json",
      "--screenshot-dir", "/tmp/screens"
    ]);
    process.stdout.write(JSON.stringify(result));
  `));

  assert.match(parsed.revision, /^[0-9a-f]{40}(?:\+dirty)?$/);
  assert.equal(parsed.revisionSource, "git-head");
  assert.equal(typeof parsed.revisionDirty, "boolean");
});

test("Given an incomplete timber-chain interaction When preflight runs Then the live loop is blocked", () => {
  const output = evalProofModule(`
    try {
      proof.assertPlaythroughPreflight({
        initialRoadRevision: 0,
        roadRevision: 1,
        constructionSites: [{ kind: "logging_camp" }]
      });
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);
  assert.match(output, /road revision delta 1 !== 3/);
});

test("Given a wrong construction set When preflight runs Then the live loop is blocked", () => {
  const output = evalProofModule(`
    try {
      proof.assertPlaythroughPreflight({
        initialRoadRevision: 0,
        roadRevision: 3,
        constructionSites: [{ kind: "logging_camp" }, { kind: "sawmill" }]
      });
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);
  assert.match(output, /construction site kinds/);
});

test("Given omitted-road evidence without an idle screenshot When asserted Then it is rejected", () => {
  const output = evalProofModule(`
    try {
      proof.assertOmittedRoadFlow({
        tick: 600, placedKinds: ["logging_camp", "sawmill"], placementState: "construction_sites_persisted",
        roadsEverPlaced: false, initialRoadRevision: 0, finalRoadRevision: 0,
        markerProof: { marker: "🚧 길이 필요합니다" }, carterCount: 0, goodsDelta: 0, productionDelta: 0,
        screenshots: ["omitted-road-placement"]
      });
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);
  assert.match(output, /omitted-road-idle screenshot/);
});

test("Given omitted-road evidence that used a road When asserted Then the fresh no-road claim is rejected", () => {
  const output = evalProofModule(`
    try {
      proof.assertOmittedRoadFlow({
        tick: 600, placedKinds: ["logging_camp", "sawmill"], placementState: "construction_sites_persisted",
        roadsEverPlaced: true, initialRoadRevision: 0, finalRoadRevision: 1,
        markerProof: { marker: "🚧 길이 필요합니다" }, carterCount: 0, goodsDelta: 0, productionDelta: 0,
        screenshots: ["omitted-road-placement", "omitted-road-idle"]
      });
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);
  assert.match(output, /fresh no-road/);
});

test("Given omitted-road evidence from a state with prior road actions When asserted Then no-road-ever provenance is rejected", () => {
  const output = evalProofModule(`
    try {
      proof.assertOmittedRoadFlow({
        tick: 600, placedKinds: ["logging_camp", "sawmill"], placementState: "construction_sites_persisted",
        roadsEverPlaced: false, initialRoadRevision: 1, finalRoadRevision: 1,
        markerProof: { marker: "🚧 길이 필요합니다" }, carterCount: 0, goodsDelta: 0, productionDelta: 0,
        screenshots: ["omitted-road-placement", "omitted-road-idle"]
      });
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);
  assert.match(output, /road revision must remain zero/);
});

test("Given playthrough evidence without a logs-carrying carter When asserted Then it is rejected", () => {
  const output = evalProofModule(`
    try {
      proof.assertPart6Playthrough({
        tick: 3000, loopObservedTicks: 3000, initialPopulation: 12, finalPopulation: 13,
        walkerStartHash: "a", walkerFinalHash: "b", logsCarter: null,
        logsTransferred: 4, timberAccumulated: 2,
        screenshots: ["fresh", "placement", "road", "walker", "goods", "final"],
        renderHash: "feedbeef", missingAssets: [], blankCanvas: false
      });
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);
  assert.match(output, /logs-carrying carter/);
});

test("Given stable population with a tautological reason When asserted Then structured house observations are required", () => {
  const output = evalProofModule(`
    try {
      proof.assertPart6Playthrough({
        tick: 3000, loopObservedTicks: 3000, initialPopulation: 12, finalPopulation: 12,
        populationOutcome: { kind: "stable", reason: "deterministic population held steady" },
        walkerStartHash: "a", walkerFinalHash: "b",
        logsCarter: { kind: "carter", phase: "outbound", cargo: { resource: "logs", amount: 2 } },
        logsTransferred: 4, timberAccumulated: 2,
        screenshots: ["fresh", "placement", "road", "walker", "goods", "final"],
        renderHash: "feedbeef", missingAssets: [], blankCanvas: false
      });
    } catch (error) { process.stdout.write(error instanceof Error ? error.message : String(error)); }
  `);
  assert.match(output, /structured population stasis/);
});

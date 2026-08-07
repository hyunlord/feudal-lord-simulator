import assert from "node:assert/strict";
import test from "node:test";

import {
  createStage3EconomyHarnessScenario,
  formatEconomyHarnessReport,
  hashEconomyState,
  runStage3EconomyHarness,
} from "../scripts/economyHarness";
import { stage3Metrics } from "../scripts/economyHarnessMetrics";
import { trackStage3Run } from "../scripts/economyHarnessStage3Trace";
import { STAGE3_MAX_NON_WALL_STALL_TICKS, STAGE3_MAX_WALL_COMPLETION_TICKS, STAGE3_PALISADE_PATH, STAGE3_PROCLAMATION_TICK } from "../scripts/economyHarnessStage3Scenario";
import type { PalisadeConstructionSite } from "../src/economy/construction";
import type { GameState, PalisadeState } from "../src/engine/engine.types";
import { confirmPalisadeProclamation } from "../src/engine/palisade";
import { advanceTick } from "../src/engine/tick";

const PALISADE: PalisadeState = {
  id: "palisade-stage3",
  polygon: [
    { x: 1, y: 1 },
    { x: 13, y: 1 },
    { x: 13, y: 9 },
    { x: 1, y: 9 },
    { x: 1, y: 1 },
  ],
  gate: { x: 7, y: 1 },
  segments: [
    {
      id: "palisade-stage3-segment-000",
      order: 0,
      edgePath: [{ x: 7, y: 1 }, { x: 11, y: 1 }],
      tileCount: 4,
      completed: false,
      constructionSiteId: "palisade-stage3-segment-000",
    },
    {
      id: "palisade-stage3-segment-001",
      order: 1,
      edgePath: [{ x: 7, y: 1 }, { x: 3, y: 1 }],
      tileCount: 4,
      completed: true,
      constructionSiteId: null,
    },
  ],
};

function withStage3Era(state: GameState, palisade: PalisadeState = PALISADE): GameState {
  return {
    ...state,
    era: "palisade",
    eraProclaimedTick: 321,
    palisade,
  };
}

test("economy harness hash changes for every Stage 3 era field", () => {
  // Given: a deterministic harness state after a palisade proclamation.
  const base = withStage3Era(createStage3EconomyHarnessScenario({ seed: 3 }));
  const baseline = hashEconomyState(base);

  // When: each new gameplay field changes independently.
  const variants: readonly GameState[] = [
    { ...base, era: "hamlet" },
    { ...base, eraProclaimedTick: 322 },
    { ...base, palisade: null },
    withStage3Era(base, { ...PALISADE, id: "palisade-stage3-renamed" }),
    withStage3Era(base, { ...PALISADE, polygon: [{ x: 2, y: 1 }, ...PALISADE.polygon.slice(1)] }),
    withStage3Era(base, { ...PALISADE, gate: { x: 8, y: 1 } }),
    withStage3Era(base, {
      ...PALISADE,
      segments: PALISADE.segments.map((segment) =>
        segment.id === "palisade-stage3-segment-000"
          ? { ...segment, completed: true, constructionSiteId: null }
          : segment,
      ),
    }),
    withStage3Era(base, {
      ...PALISADE,
      segments: PALISADE.segments.map((segment) =>
        segment.id === "palisade-stage3-segment-000"
          ? { ...segment, order: 2 }
          : segment,
      ),
    }),
  ];

  // Then: every gameplay mutation contributes to determinism.
  for (const variant of variants) {
    assert.notEqual(hashEconomyState(variant), baseline);
  }
});

test("economy harness normalizes palisade segment input order but preserves gameplay order values", () => {
  // Given: the same palisade segments supplied in two physical array orders.
  const scenario = createStage3EconomyHarnessScenario({ seed: 3 });
  const ordered = withStage3Era(scenario);
  const reversed = withStage3Era(scenario, {
    ...PALISADE,
    segments: [...PALISADE.segments].reverse(),
  });

  // When: both states are hashed.
  const orderedHash = hashEconomyState(ordered);
  const reversedHash = hashEconomyState(reversed);

  // Then: physical array order is normalized by segment order.
  assert.equal(reversedHash, orderedHash);
});

test("economy harness excludes presentation-only clocks from deterministic gameplay hash", () => {
  // Given: a gameplay state and the same state widened with presentation-only timing fields.
  const scenario = createStage3EconomyHarnessScenario({ seed: 3 });
  const widened = {
    ...scenario,
    editDraftStartedAtMs: 1_000,
    ceremonyDismissedAtMs: 2_000,
    materialWaveNowMs: 3_000,
  };

  // When: both states are hashed by the gameplay serializer.
  const gameplayHash = hashEconomyState(scenario);
  const presentationHash = hashEconomyState(widened);

  // Then: presentation clocks do not affect replay determinism.
  assert.equal(presentationHash, gameplayHash);
});

test("economy harness hash changes for wall construction metadata", () => {
  // Given: a real Stage 3 state immediately after proclamation.
  let proclaimed = createStage3EconomyHarnessScenario({ seed: 3 });
  while (proclaimed.tick < STAGE3_PROCLAMATION_TICK) proclaimed = advanceTick(proclaimed);
  proclaimed = confirmPalisadeProclamation(proclaimed, STAGE3_PALISADE_PATH);
  const site = proclaimed.constructionSites.find((candidate): candidate is PalisadeConstructionSite =>
    candidate.kind === "palisade_segment",
  );
  assert.ok(site !== undefined);
  const base = {
    ...proclaimed,
    constructionSites: [site],
  };
  const baseline = hashEconomyState(base);

  // When: every wall-specific metadata field changes independently.
  const variants = [
    { ...site, wallId: `${site.wallId}-changed` },
    { ...site, segmentIndex: site.segmentIndex + 1 },
    { ...site, gateDistance: site.gateDistance + 1 },
    { ...site, order: site.order + 1 },
    { ...site, path: [{ x: site.path[0]?.x ?? 0, y: (site.path[0]?.y ?? 0) + 1 }, ...site.path.slice(1)] },
    { ...site, anchor: { tx: site.anchor.tx + 1, ty: site.anchor.ty } },
  ].map((mutated) => ({
    ...base,
    constructionSites: [mutated],
  }));

  // Then: each wall-site field contributes to the deterministic hash.
  for (const variant of variants) {
    assert.notEqual(hashEconomyState(variant), baseline);
  }
});

test("economy harness prints Stage 3 hash and wall timing metrics", () => {
  // Given: the Stage 3 deterministic harness report.
  const report = runStage3EconomyHarness();

  // When: the report is formatted for CLI output.
  const output = formatEconomyHarnessReport(report);

  // Then: Stage 3 proof rows are visible with the legacy baseline hash.
  assert.equal(report.stage3.hashA, report.stage3.hashB);
  assert.ok((report.stage3.requirementsMetTick ?? Number.POSITIVE_INFINITY) <= 12_000);
  assert.ok((report.stage3.wallCompletionElapsedTicks ?? Number.POSITIVE_INFINITY) <= STAGE3_MAX_WALL_COMPLETION_TICKS);
  assert.ok(report.stage3.maxNonWallProductionStall < STAGE3_MAX_NON_WALL_STALL_TICKS);
  assert.match(output, /Legacy Stage 2 hash\s+5a393f13af3e61be\s+PASS/);
  assert.match(output, /Stage 3 determinism hash\s+\S+ == \S+\s+PASS/);
  assert.match(output, /Palisade reachability\s+.+\s+PASS/);
  assert.match(output, /Palisade wall completion\s+.+\s+PASS/);
  assert.match(output, /Palisade labour continuity\s+.+\s+PASS/);
});

test("economy harness Stage 3 scenario produces two identical fresh runs", () => {
  // Given: two fresh copies of the fixed Stage 3 harness scenario.
  const first = trackStage3Run(createStage3EconomyHarnessScenario({ seed: 3 }));
  const second = trackStage3Run(createStage3EconomyHarnessScenario({ seed: 3 }));

  // When: both runs complete through the real tick/proclamation/wall pipeline.
  // Then: final hashes and timing facts match exactly.
  assert.equal(first.hash, second.hash);
  assert.equal(first.proclamationTick, 600);
  assert.equal(first.wallCompleteTick, second.wallCompleteTick);
  assert.equal(first.wallCompletionElapsedTicks, second.wallCompletionElapsedTicks);
});

test("economy harness Stage 3 adversarial variants isolate reachability, completion, and labour failures", () => {
  // Given: the Stage 3 metric predicates expressed through realistic traces or trace-shaped variants.
  const good = trackStage3Run(createStage3EconomyHarnessScenario({ seed: 3 }));
  const unreachable = { ...good, requirementsMetTick: null };
  const unfinished = { ...good, wallCompleteTick: null, wallCompletionElapsedTicks: null };
  const halted = { ...good, maxNonWallProductionStall: STAGE3_MAX_NON_WALL_STALL_TICKS };

  // When: each adversarial trace is passed through the same metric-row builder as the CLI.
  const failedLabels = (trace: typeof good): readonly string[] =>
    stage3Metrics(trace, trace)
      .filter((metric) => metric.status === "FAIL")
      .map((metric) => metric.label);

  // Then: each adversarial mutation targets one intended gate.
  assert.deepEqual(failedLabels(good), []);
  assert.deepEqual(failedLabels(unreachable), ["Palisade reachability"]);
  assert.deepEqual(failedLabels(unfinished), ["Palisade wall completion"]);
  assert.deepEqual(failedLabels(halted), ["Palisade labour continuity"]);
});

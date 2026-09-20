import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Building } from "../src/content/buildingConfig";
import { createPalisadeConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { EraConsole, buildEraConsoleModel } from "../src/ui/EraConsole";
import { palisadeFootprintsForState } from "../src/engine/palisadeFootprints";
import { initialPalisadeDraft } from "../src/render/palisadeDraftInteraction";
import { computePalisadeProposal, validatePalisadeCandidate } from "../src/world/palisadeGeometry";

const APP_SOURCE = new URL("../src/App.tsx", import.meta.url);
const CANVAS_RUNTIME_SOURCE = new URL("../src/render/useGameCanvasRuntime.ts", import.meta.url);

function tile(tx: number, ty: number, hasRoad = false) {
  return { tx, ty, terrain: "grass", buildingId: null, hasRoad } as const;
}

function building(input: Pick<Building, "id" | "kind" | "tx" | "ty">): Building {
  return {
    ...input,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function state(overrides: Partial<GameState> = {}): GameState {
  const buildings = overrides.buildings ?? [
    building({ id: "house-a", kind: "house", tx: 10, ty: 10 }),
    building({ id: "house-b", kind: "house", tx: 13, ty: 10 }),
    building({ id: "granary-a", kind: "granary", tx: 10, ty: 13 }),
    building({ id: "chapel-a", kind: "chapel", tx: 13, ty: 13 }),
  ];
  return {
    tick: 0,
    seed: 1,
    width: 32,
    height: 32,
    tiles: Array.from({ length: 32 * 32 }, (_, index) => tile(index % 32, Math.floor(index / 32), index % 8 === 0)),
    buildings,
    constructionSites: [],
    houses: [],
    walkers: [],
    population: 60,
    idleWorkers: 0,
    treasuryTimber: 800,
    treasuryCoin: 0,
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    roadRevision: 0,
    pathCache: {},
    forestHarvests: [],
    ...overrides,
  };
}

test("era console exposes four independent gauges exact tooltip and enabled proposal costs", () => {
  // Given: a hamlet that satisfies all four requirements.
  const model = buildEraConsoleModel({ state: state(), draft: null });

  // When / Then: every row stays independent and the proclamation copy is exact.
  assert.deepEqual(model.requirements.map((row) => [row.key, row.label, row.current, row.target, row.met]), [
    ["population", "인구", 60, 60, true],
    ["granary", "곡창", 1, 1, true],
    ["chapel", "예배당", 1, 1, true],
    ["timber", "목재", 800, 250, true],
  ]);
  assert.equal(model.tooltip, "선포하면 일꾼의 40%가 성벽 공사에 배정됩니다 (약 600틱)");
  assert.equal(model.action.enabled, true);
  assert.equal(model.action.label, "목책 시대 선포 준비");
  assert.match(model.proposal.label, /둘레 \d+칸/);
  assert.match(model.proposal.label, /목재 \d+/);
  assert.match(model.proposal.label, /공사 \d+구간/);
});

test("era console explains disabled proposal and never leaks raw enums", () => {
  // Given: population is the only missing gauge.
  const model = buildEraConsoleModel({ state: state({ population: 59 }), draft: null });
  const markup = renderToStaticMarkup(createElement(EraConsole, {
    model,
    onBeginProposal: () => undefined,
    onConfirmProposal: () => undefined,
    onCancelProposal: () => undefined,
  }));

  // When / Then
  assert.equal(model.action.enabled, false);
  assert.match(model.action.reason ?? "", /인구 59\/60/);
  assert.match(markup, /인구/);
  assert.match(markup, /59\/60/);
  assert.match(markup, /목책 시대/);
  assert.doesNotMatch(markup, /insufficient_enclosure|water_crossing|open_polygon|queued/);
});

test("era console reports wall progress queued active diagnostic and irreversible cancellation copy", () => {
  // Given: a proclaimed palisade with one completed, one active, and one queued segment.
  const active = createPalisadeConstructionSite({
    id: "wall-a-segment-001",
    wallId: "wall-a",
    segmentIndex: 1,
    gateDistance: 1,
    order: 1,
    path: [{ x: 4, y: 4 }, { x: 8, y: 4 }],
    startedTick: 0,
  });
  const queued = createPalisadeConstructionSite({
    id: "wall-a-segment-002",
    wallId: "wall-a",
    segmentIndex: 2,
    gateDistance: 2,
    order: 2,
    path: [{ x: 8, y: 4 }, { x: 8, y: 8 }],
    startedTick: 0,
  });
  const model = buildEraConsoleModel({
    state: state({
      era: "palisade",
      eraProclaimedTick: 10,
      constructionSites: [active, queued],
      palisade: {
        id: "wall-a",
        gate: { x: 4, y: 4 },
        polygon: [{ x: 4, y: 4 }, { x: 8, y: 4 }, { x: 8, y: 8 }, { x: 4, y: 4 }],
        segments: [
          { id: "wall-a-segment-000", order: 0, edgePath: [{ x: 4, y: 4 }, { x: 4, y: 8 }], tileCount: 4, completed: true, constructionSiteId: null },
          { id: active.id, order: 1, edgePath: active.path, tileCount: 4, completed: false, constructionSiteId: active.id },
          { id: queued.id, order: 2, edgePath: queued.path, tileCount: 4, completed: false, constructionSiteId: queued.id },
        ],
      },
    }),
    draft: null,
  });

  // When / Then
  assert.equal(model.currentEraLabel, "목책마을");
  assert.equal(model.wallProgress, "성벽 1 / 3 구간");
  assert.match(model.diagnostic ?? "", /활성 구간 2\/3/);
  assert.match(model.diagnostic ?? "", /대기 1구간/);
  assert.match(model.irreversibleNotice ?? "", /선포 후 성벽 구간은 취소할 수 없습니다/);
});

test("era console exposes Stone Town label gauges and exact proclamation labour copy", () => {
  // Given
  const model = buildEraConsoleModel({
    state: state({
      era: "palisade",
      population: 140,
      treasuryCoin: 200,
      buildings: [
        building({ id: "market-a", kind: "market", tx: 10, ty: 10 }),
        building({ id: "masonry-a", kind: "masonry", tx: 12, ty: 10 }),
        {
          ...building({ id: "store-a", kind: "storehouse", tx: 14, ty: 10 }),
          inventory: { stone: 400 },
        },
      ],
    }),
    draft: null,
  });
  const markup = renderToStaticMarkup(createElement(EraConsole, {
    model,
    onBeginProposal: () => undefined,
    onConfirmProposal: () => undefined,
    onCancelProposal: () => undefined,
  }));

  // When / Then
  assert.equal(model.currentEraLabel, "목책마을");
  assert.deepEqual(model.requirements.map((row) => [row.key, row.label, row.current, row.target, row.met]), [
    ["population", "인구", 140, 140, true],
    ["market", "시장", 1, 1, true],
    ["masonry", "석공소", 1, 1, true],
    ["stone", "석재", 400, 400, true],
    ["coin", "금화", 200, 200, true],
  ]);
  assert.equal(model.tooltip, "선포하면 일꾼의 50%가 석조 전환 공사에 배정됩니다 (약 900틱)");
  assert.equal(model.action.enabled, true);
  assert.equal(model.action.label, "석조 도시 선포");
  assert.match(markup, /석조 도시 선포/);
  assert.match(markup, /400\/400/);
});

test("era console labels the proclaimed Stone Town current era without enabling repeats", () => {
  // Given
  const model = buildEraConsoleModel({
    state: state({ era: "stone_town" }),
    draft: null,
  });

  // When / Then
  assert.equal(model.currentEraLabel, "석조 도시");
  assert.equal(model.action.enabled, false);
  assert.equal(model.action.reason, "이미 석조 도시가 선포되었습니다");
});

test("era console source uses presentation-only draft state and canvas runtime handles Escape without simulation mutation", async () => {
  // Given / When
  const appSource = await readFile(APP_SOURCE, "utf8");
  const runtimeSource = await readFile(CANVAS_RUNTIME_SOURCE, "utf8");

  // Then
  assert.match(appSource, /useState<PalisadeDraftState \| null>\(/);
  assert.match(appSource, /setPalisadeDraft/);
  assert.match(appSource, /type: "confirm_palisade_proclamation"/);
  assert.match(
    appSource,
    /if \(confirmPalisadeProclamation\(state, candidatePath\) === state\) return;/,
  );
  assert.doesNotMatch(appSource, /palisadeDraft:\s*state/);
  assert.match(runtimeSource, /palisadeDraftRef/);
  assert.match(runtimeSource, /onPalisadeDraftCancel/);
  assert.match(runtimeSource, /event\.code === "Escape"/);
});

test("hamlet keeps proposal failure details even when all requirements hide the proposal", () => {
  // Given
  const current = state({ population: 0, treasuryTimber: 0, buildings: [] });

  // When
  const model = buildEraConsoleModel({ state: current, draft: null });

  // Then
  assert.deepEqual(model.proposal, {
    visible: false,
    label: "목책 제안 불가",
    failure: "완성된 건물이 없어 둘레를 잡을 수 없습니다",
  });
  assert.equal(model.action.reason, "인구 0/60");
});

test("hamlet with met requirements still rejects invalid proposal geometry", () => {
  // Given
  const current = state({ tiles: state().tiles.map((entry) => ({ ...entry, terrain: "water" })) });

  // When
  const model = buildEraConsoleModel({ state: current, draft: null });

  // Then
  assert.equal(model.requirements.every((requirement) => requirement.met), true);
  assert.equal(model.action.enabled, false);
  assert.equal(model.action.reason, "유효한 목책 제안을 만들 수 없습니다");
  assert.equal(model.proposal.visible, true);
  assert.equal(model.proposal.failure, "목책선이 물을 가로지릅니다");
});

test("hamlet draft retains selected run, failure, confirmation and cancellation controls", () => {
  // Given
  const current = state();
  const footprints = palisadeFootprintsForState(current);
  const proposal = computePalisadeProposal(current, footprints);
  assert.equal(proposal.ok, true);
  if (!proposal.ok) return;
  const validated = validatePalisadeCandidate(current, proposal.path, footprints);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  const draft = { ...initialPalisadeDraft(validated.candidate), selectedRunIndex: 0, failureReason: "water_crossing" as const };

  // When
  const model = buildEraConsoleModel({ state: current, draft });
  const markup = renderToStaticMarkup(createElement(EraConsole, {
    model,
    onBeginProposal: () => undefined,
    onConfirmProposal: () => undefined,
    onCancelProposal: () => undefined,
  }));

  // Then
  assert.equal(model.action.label, "목책 시대 선포 확정");
  assert.equal(model.draft.editing, true);
  assert.match(model.draft.selectedRunLabel ?? "", /^선택 구간 1 · \d+칸$/);
  assert.equal(model.draft.failure, "목책선이 물을 가로지릅니다");
  assert.match(markup, /제안 취소/);
  assert.equal(model.proposal.visible, true);
});

for (const era of ["palisade", "stone_town"] as const) {
  test(`${era} does not read terrain for an unused initial wall proposal`, () => {
    // Given: era requirements and wall diagnostics do not need proposal terrain.
    const current = state({ era });
    Object.defineProperty(current, "tiles", {
      get() { assert.fail("later-era console read proposal-only terrain"); },
    });

    // When
    const model = buildEraConsoleModel({ state: current, draft: null });

    // Then: an absent proposal has no hidden success or failure claim.
    assert.deepEqual(model.proposal, { visible: false, label: "", failure: null });
    assert.equal(model.action.targetEra, "stone_town");
  });

  test(`${era} keeps proposal text out of rendered controls`, () => {
    // Given
    const current = state({ era });

    // When
    const model = buildEraConsoleModel({ state: current, draft: null });
    const markup = renderToStaticMarkup(createElement(EraConsole, {
      model,
      onBeginProposal: () => undefined,
      onConfirmProposal: () => undefined,
      onCancelProposal: () => undefined,
    }));

    // Then
    assert.equal(model.proposal.visible, false);
    assert.equal(model.action.enabled, false);
    assert.equal(model.action.reason, era === "palisade" ? "인구 60/140" : "이미 석조 도시가 선포되었습니다");
    assert.doesNotMatch(markup, /era-proposal|목책 제안 불가|둘레 \d+칸/);
    assert.equal(model.action.targetEra, "stone_town");
  });
}
